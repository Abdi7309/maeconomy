<?php
// Enable error reporting for development
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Set headers for CORS (Cross-Origin Resource Sharing)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle preflight OPTIONS requests for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = 'localhost';
$db   = 'maeconomy';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

// Get port from query parameter, default to 3306 if not set
$port = $_GET['db_port'] ?? '3306';

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(["message" => "Database connection error: " . $e->getMessage()]);
    exit();
}

// --- User Management Functions ---
function registerUser($pdo, $username, $password) {
    // Check if user already exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        return ["success" => false, "message" => "Username already exists."];
    }

    // Hash the password for security
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    if ($stmt->execute([$username, $hashed_password])) {
        return ["success" => true, "message" => "User registered successfully."];
    } else {
        return ["success" => false, "message" => "Failed to register user."];
    }
}

function loginUser($pdo, $username, $password) {
    $stmt = $pdo->prepare("SELECT id, username, password FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        // In a real app, you would generate a session token or JWT here
        return ["success" => true, "message" => "Login successful.", "user" => ["id" => $user['id'], "username" => $user['username']]];
    } else {
        return ["success" => false, "message" => "Invalid username or password."];
    }
}


// --- HELPER FUNCTION to get files for a property ---
function getPropertyFiles($pdo, $property_id) {
    $stmt = $pdo->prepare("SELECT id, file_path, file_name, file_type FROM property_files WHERE property_id = ?");
    $stmt->execute([$property_id]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}


// Function to fetch an object and its children/properties recursively
function fetchItemWithHierarchy($pdo, $id) {
    $stmt = $pdo->prepare("SELECT o.id, o.parent_id, o.user_id, o.naam, o.created_at, o.updated_at, u.username as owner_name
                           FROM objects o
                           LEFT JOIN users u ON o.user_id = u.id
                           WHERE o.id = ?");
    $stmt->execute([$id]);
    $item = $stmt->fetch();

    if (!$item) {
        return null;
    }

    // Fetch properties for the current object (using 'eigenschappen' table)
    $stmt_prop = $pdo->prepare("SELECT id, object_id, name, waarde, formule, eenheid, created_at, updated_at FROM eigenschappen WHERE object_id = ?");
    $stmt_prop->execute([$item['id']]);
    $properties = $stmt_prop->fetchAll();

    // For each property, fetch its associated files
    foreach ($properties as &$property) {
        $property['files'] = getPropertyFiles($pdo, $property['id']);
    }
    $item['properties'] = $properties;


    // Fetch children for the current object recursively
    $stmt_children = $pdo->prepare("SELECT id FROM objects WHERE parent_id = ? ORDER BY naam ASC");
    $stmt_children->execute([$item['id']]);
    $children_ids = $stmt_children->fetchAll(PDO::FETCH_COLUMN);

    $item['children'] = [];
    foreach ($children_ids as $child_id) {
        $item['children'][] = fetchItemWithHierarchy($pdo, $child_id);
    }

    return $item;
}

// Helper function to get properties for a given template_id
function getTemplateProperties($pdo, $template_id) {
    // Select the new column 'property_value'
    $stmt = $pdo->prepare("SELECT id, property_name, property_value FROM template_properties WHERE template_id = ? ORDER BY property_name ASC");
    $stmt->execute([$template_id]);
    return $stmt->fetchAll();
}

// Helper function to update template properties
function updateTemplateProperties($pdo, $template_id, $properties) {
    // Check for duplicate property_name in $properties
    $names = array_map(function($p) { return $p['property_name']; }, $properties);
    if (count($names) !== count(array_unique($names))) {
        throw new Exception("Dubbele eigenschap namen zijn niet toegestaan in één sjabloon.");
    }
    try {
        // First, delete existing properties for the template
        $stmt_delete = $pdo->prepare("DELETE FROM template_properties WHERE template_id = ?");
        $stmt_delete->execute([$template_id]);

        // Then, insert the new/updated properties
        $stmt_insert = $pdo->prepare("INSERT INTO template_properties (template_id, property_name, property_value) VALUES (?, ?, ?)");
        foreach ($properties as $prop) {
            if (isset($prop['property_name']) && !empty($prop['property_name'])) {
                $property_value = $prop['property_value'] ?? '';
                $stmt_insert->execute([$template_id, $prop['property_name'], $property_value]);
            }
        }
        return true;
    } catch (\PDOException $e) {
        error_log("Failed to update template properties: " . $e->getMessage());
        throw $e;
    }
}


// Get the requested entity and method
$entity = $_GET['entity'] ?? '';
$action = $_GET['action'] ?? ''; // New 'action' parameter for users
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null; // For specific item operations
$object_id = $_GET['object_id'] ?? null; // For properties related to an object

// Get request body for POST/PUT requests
$input = (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false)
    ? json_decode(file_get_contents('php://input'), true)
    : null;


switch ($entity) {
    case 'users':
        if ($method === 'GET') {
            // Get total object count
            $total_stmt = $pdo->prepare("SELECT COUNT(id) as total FROM objects");
            $total_stmt->execute();
            $total_count = $total_stmt->fetchColumn();
    
            // Fetch all users
            $stmt = $pdo->prepare("SELECT id, username FROM users ORDER BY username ASC");
            $stmt->execute();
            $users = $stmt->fetchAll();
    
            // For each user, get their object count
            foreach ($users as &$user) {
                $count_stmt = $pdo->prepare("SELECT COUNT(id) as count FROM objects WHERE user_id = ?");
                $count_stmt->execute([$user['id']]);
                $user['object_count'] = (int)$count_stmt->fetchColumn();
            }
    
            http_response_code(200);
            echo json_encode([
                "users" => $users,
                "total_objects" => (int)$total_count
            ]);
            break;
        }

        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(["message" => "Method not allowed for users entity. Use POST or GET."]);
            break;
        }
        if (!isset($input['username']) || !isset($input['password'])) {
            http_response_code(400);
            echo json_encode(["message" => "Missing username or password."]);
            break;
        }

        switch ($action) {
            case 'register':
                $result = registerUser($pdo, $input['username'], $input['password']);
                if ($result['success']) {
                    http_response_code(201);
                } else {
                    http_response_code(409); // Conflict
                }
                echo json_encode($result);
                break;
            case 'login':
                $result = loginUser($pdo, $input['username'], $input['password']);
                if ($result['success']) {
                    http_response_code(200);
                } else {
                    http_response_code(401); // Unauthorized
                }
                echo json_encode($result);
                break;
            default:
                http_response_code(400);
                echo json_encode(["message" => "Invalid action for users entity. Use 'register' or 'login'."]);
                break;
        }
        break;

    case 'objects':
        switch ($method) {
            case 'GET':
                if ($id) {
                    // Get a single object with its hierarchy
                    $data = fetchItemWithHierarchy($pdo, $id);
                    if ($data) {
                        http_response_code(200);
                        echo json_encode($data);
                    } else {
                        http_response_code(404);
                        echo json_encode(["message" => "Object not found."]);
                    }
                } else {
                    // Get all top-level objects or children of a specific parent
                    $sql = "SELECT o.id, o.parent_id, o.user_id, o.naam, o.created_at, o.updated_at, u.username as owner_name 
                            FROM objects o 
                            LEFT JOIN users u ON o.user_id = u.id ";
                    $params = [];

                    // Handle parent_id filter
                    if (isset($_GET['parent_id']) && $_GET['parent_id'] !== '') {
                        $sql .= "WHERE o.parent_id = ? ";
                        $params[] = $_GET['parent_id'];
                    } else {
                        $sql .= "WHERE o.parent_id IS NULL ";
                    }

                    // Handle user_id filter
                    if (isset($_GET['filter_user_id']) && $_GET['filter_user_id'] !== 'all') {
                        $sql .= "AND o.user_id = ? ";
                        $params[] = $_GET['filter_user_id'];
                    }

                    $sql .= "ORDER BY o.naam ASC";

                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $objects = $stmt->fetchAll();

                    // For each object, fetch its properties and immediate children count
                    foreach ($objects as &$object) {
                        $stmt_prop = $pdo->prepare("SELECT id, object_id, name, waarde, created_at, updated_at FROM eigenschappen WHERE object_id = ?");
                        $stmt_prop->execute([$object['id']]);
                        $object['properties'] = $stmt_prop->fetchAll();

                        $stmt_children_count = $pdo->prepare("SELECT COUNT(id) FROM objects WHERE parent_id = ?");
                        $stmt_children_count->execute([$object['id']]);
                        $object['children_count'] = $stmt_children_count->fetchColumn(); // Just a count, not the full objects
                    }

                    http_response_code(200);
                    echo json_encode($objects);
                }
                break;

            case 'POST':
                if (!isset($input['name']) || !isset($input['user_id'])) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'name' or 'user_id' for new object."]);
                    break;
                }
                $parent_id = $input['parent_id'] ?? null;
                $user_id = $input['user_id'];

                $stmt = $pdo->prepare("INSERT INTO objects (parent_id, user_id, naam, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
                if ($stmt->execute([$parent_id, $user_id, $input['name']])) {
                    $new_id = $pdo->lastInsertId();
                    http_response_code(201); // Created
                    echo json_encode(["message" => "Object created successfully.", "id" => $new_id]);
                } else {
                    http_response_code(500);
                    echo json_encode(["message" => "Failed to create object."]);
                }
                break;

            case 'PUT':
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'id' for object update."]);
                    break;
                }
                if (!isset($input['name'])) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'name' for object update."]);
                    break;
                }
                $stmt = $pdo->prepare("UPDATE objects SET naam = ?, updated_at = NOW() WHERE id = ?");
                if ($stmt->execute([$input['name'], $id])) {
                    http_response_code(200);
                    echo json_encode(["message" => "Object updated successfully."]);
                } else {
                    http_response_code(500);
                    echo json_encode(["message" => "Failed to update object."]);
                }
                break;

            case 'DELETE':
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'id' for object deletion."]);
                    break;
                }
                $stmt = $pdo->prepare("DELETE FROM objects WHERE id = ?");
                if ($stmt->execute([$id])) {
                    http_response_code(200);
                    echo json_encode(["message" => "Object deleted successfully."]);
                } else {
                    http_response_code(500);
                    echo json_encode(["message" => "Failed to delete object."]);
                }
                break;

            default:
                http_response_code(405); // Method Not Allowed
                echo json_encode(["message" => "Method not allowed for objects entity."]);
                break;
        }
        break;

    case 'properties':
        switch ($method) {
            case 'GET':
                if (!$object_id) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'object_id' for properties query."]);
                    break;
                }
                $stmt = $pdo->prepare("SELECT id, object_id, name, waarde, formule, eenheid, created_at, updated_at FROM eigenschappen WHERE object_id = ? ORDER BY name ASC");
                $stmt->execute([$object_id]);
                $properties = $stmt->fetchAll();
                http_response_code(200);
                echo json_encode($properties);
                break;

            case 'POST':
                // Data now comes from multipart/form-data, so we use $_POST and $_FILES
                if (!isset($_POST['object_id']) || !isset($_POST['name'])) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'object_id' or 'name' for new property."]);
                    break;
                }

                $object_id = $_POST['object_id'];
                $name = $_POST['name'];
                $waarde = $_POST['waarde'] ?? '';
                $formule = $_POST['formule'] ?? '';
                $eenheid = $_POST['eenheid'] ?? '';

                $pdo->beginTransaction();
                try {
                    // Insert the property text data
                    $stmt = $pdo->prepare("INSERT INTO eigenschappen (object_id, name, waarde, formule, eenheid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())");
                    $stmt->execute([$object_id, $name, $waarde, $formule, $eenheid]);
                    $new_property_id = $pdo->lastInsertId();

                    $uploadDir = 'uploads/';

                    // --- Handle multiple file uploads (files[]) ---
                    if (isset($_FILES['files'])) {
                        $files = $_FILES['files'];
                        for ($i = 0; $i < count($files['name']); $i++) {
                            if ($files['error'][$i] === UPLOAD_ERR_OK) {
                                $originalName = basename($files["name"][$i]);
                                $fileExtension = pathinfo($originalName, PATHINFO_EXTENSION);
                                $safeFileName = uniqid('file_', true) . '.' . $fileExtension;
                                $uploadFilePath = $uploadDir . $safeFileName;

                                if (move_uploaded_file($files['tmp_name'][$i], $uploadFilePath)) {
                                    $stmt_file = $pdo->prepare("INSERT INTO property_files (property_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)");
                                    $stmt_file->execute([$new_property_id, $uploadFilePath, $originalName, $files['type'][$i]]);
                                } else {
                                    throw new Exception("Server error: Failed to move uploaded file '{$originalName}'. Check folder permissions.");
                                }
                            }
                        }
                    }

                    // --- Also handle single file upload (file) for backward compatibility ---
                    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
                        $file = $_FILES['file'];
                        $originalName = basename($file["name"]);
                        $fileExtension = pathinfo($originalName, PATHINFO_EXTENSION);
                        $safeFileName = uniqid('file_', true) . '.' . $fileExtension;
                        $uploadFilePath = $uploadDir . $safeFileName;

                        if (move_uploaded_file($file['tmp_name'], $uploadFilePath)) {
                            $stmt_file = $pdo->prepare("INSERT INTO property_files (property_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)");
                            $stmt_file->execute([$new_property_id, $uploadFilePath, $originalName, $file['type']]);
                        } else {
                            throw new Exception("Server error: Failed to move uploaded file. Check folder permissions.");
                        }
                    }

                    $pdo->commit();
                    http_response_code(201);
                    echo json_encode(["message" => "Property created successfully.", "id" => $new_property_id]);

                } catch (Exception $e) {
                    $pdo->rollBack();
                    error_log("Error in property creation: " . $e->getMessage());
                    http_response_code(500);
                    echo json_encode(["message" => "Failed to create property: " . $e->getMessage()]);
                }
                break;

            case 'PUT':
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'id' for property update."]);
                    break;
                }
                if (!isset($input['name']) || !isset($input['waarde'])) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'name' or 'waarde' for property update."]);
                    break;
                }
                $formule = $input['formule'] ?? '';
                $stmt = $pdo->prepare("UPDATE eigenschappen SET name = ?, waarde = ?, formule = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$input['name'], $input['waarde'], $formule, $id]);
                http_response_code(200);
                echo json_encode(["message" => "Property updated successfully."]);
                break;

            case 'DELETE':
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'id' for property deletion."]);
                    break;
                }
                $stmt = $pdo->prepare("DELETE FROM eigenschappen WHERE id = ?");
                if ($stmt->execute([$id])) {
                    http_response_code(200);
                    echo json_encode(["message" => "Property deleted successfully."]);
                } else {
                    http_response_code(500);
                    echo json_encode(["message" => "Failed to delete property."]);
                }
                break;

            default:
                http_response_code(405); // Method Not Allowed
                echo json_encode(["message" => "Method not allowed for properties entity."]);
                break;
        }
        break;

    case 'templates':
        switch ($method) {
            case 'GET':
                if ($id) {
                    // Fetch a single template with its properties
                    $stmt = $pdo->prepare("SELECT id, name, description FROM templates WHERE id = ?");
                    $stmt->execute([$id]);
                    $template = $stmt->fetch();

                    if ($template) {
                        $template['properties'] = getTemplateProperties($pdo, $template['id']);
                        http_response_code(200);
                        echo json_encode($template);
                    } else {
                        http_response_code(404);
                        echo json_encode(["message" => "Template not found."]);
                    }
                } else {
                    // Fetch all templates (list only)
                    $stmt = $pdo->prepare("SELECT id, name, description FROM templates ORDER BY name ASC");
                    $stmt->execute();
                    $templates = $stmt->fetchAll();
                    http_response_code(200);
                    echo json_encode($templates);
                }
                break;

            case 'POST':
                // Log incoming data for debugging
                error_log("Template POST input: " . json_encode($input));
                
                if (!isset($input['name']) || empty(trim($input['name']))) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing or empty 'name' for new template."]);
                    break;
                }
                
                $description = $input['description'] ?? null;
                
                // Start transaction for template and properties
                $pdo->beginTransaction();
                error_log("Begin transaction");
                try {
                    // Insert template
                    $stmt = $pdo->prepare("INSERT INTO templates (name, description) VALUES (?, ?)");
                    if (!$stmt->execute([trim($input['name']), $description])) {
                        throw new Exception("Failed to insert template");
                    }
                    
                    $new_id = $pdo->lastInsertId();
                    
                    // Add template properties if provided
                    if (isset($input['properties']) && is_array($input['properties']) && !empty($input['properties'])) {
                        // Filter out empty properties
                        $validProperties = array_filter($input['properties'], function($prop) {
                            // Controleer of zowel property_name bestaat en niet leeg is
                            return isset($prop['property_name']) && !empty(trim($prop['property_name']));
                        });

                        if (!empty($validProperties)) {
                            // $validProperties bevat ook 'property_value' indien aanwezig
                            updateTemplateProperties($pdo, $new_id, $validProperties);
                        }
                    }
                    
                    $pdo->commit();
                    error_log("Commit transaction");
                    http_response_code(201);
                    echo json_encode([
                        "message" => "Template created successfully.", 
                        "id" => $new_id,
                        "properties_count" => count($input['properties'] ?? [])
                    ]);
                    
                } catch (Exception $e) {
                    $pdo->rollBack();
                    error_log("Template creation failed: " . $e->getMessage());
                    http_response_code(500);
                    echo json_encode(["message" => "Failed to create template: " . $e->getMessage()]);
                }
                break;

            case 'PUT': // Allow updating existing templates
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'id' for template update."]);
                    break;
                }
                if (!isset($input['name'])) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'name' for template update."]);
                    break;
                }
                
                $description = $input['description'] ?? null;
                
                $pdo->beginTransaction();
                try {
                    $stmt = $pdo->prepare("UPDATE templates SET name = ?, description = ? WHERE id = ?");
                    if (!$stmt->execute([$input['name'], $description, $id])) {
                        throw new Exception("Failed to update template");
                    }
                    
                    // Update template properties if provided
                    if (isset($input['properties']) && is_array($input['properties'])) {
                        // $input['properties'] bevat ook 'property_value' indien aanwezig
                        updateTemplateProperties($pdo, $id, $input['properties']);
                    }
                    
                    $pdo->commit();
                    http_response_code(200);
                    echo json_encode(["message" => "Template updated successfully."]);
                    
                } catch (Exception $e) {
                    $pdo->rollBack();
                    error_log("Template update failed: " . $e->getMessage());
                    http_response_code(500);
                    echo json_encode(["message" => "Failed to update template: " . $e->getMessage()]);
                }
                break;

            case 'DELETE': // Allow deleting templates
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(["message" => "Missing 'id' for template deletion."]);
                    break;
                }
                
                $pdo->beginTransaction();
                try {
                    // First delete template properties
                    $stmt_props = $pdo->prepare("DELETE FROM template_properties WHERE template_id = ?");
                    $stmt_props->execute([$id]);
                    
                    // Then delete template
                    $stmt = $pdo->prepare("DELETE FROM templates WHERE id = ?");
                    if (!$stmt->execute([$id])) {
                        throw new Exception("Failed to delete template");
                    }
                    
                    $pdo->commit();
                    http_response_code(200);
                    echo json_encode(["message" => "Template deleted successfully."]);
                    
                } catch (Exception $e) {
                    $pdo->rollBack();
                    error_log("Template deletion failed: " . $e->getMessage());
                    http_response_code(500);
                    echo json_encode(["message" => "Failed to delete template: " . $e->getMessage()]);
                }
                break;

            default:
                http_response_code(405); // Method Not Allowed
                echo json_encode(["message" => "Method not allowed for templates entity."]);
                break;
        }
        break;

    default:
        http_response_code(400); // Bad Request
        echo json_encode(["message" => "Invalid entity specified. Use 'objects', 'properties', 'templates', or 'users'."]);
        break;
}

?>