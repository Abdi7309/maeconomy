import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar } from 'react-native';
import { User, Lock } from 'lucide-react-native';
import AppStyles, { colors } from '../AppStyles';

const AuthScreen = ({ onLogin, onRegister, authError, setAuthError, isLoading, currentView, setCurrentView }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={AppStyles.authContainer}>
            <StatusBar barStyle="dark-content" />
            <View>
                <Text style={AppStyles.authTitle}>
                    {currentView === 'login' ? 'Welcome Back!' : 'Create Account'}
                </Text>
                <Text style={AppStyles.authSubtitle}>
                    {currentView === 'login' ? 'Sign in to continue' : 'Get started by creating a new account'}
                </Text>

                <View style={AppStyles.formGroup}>
                    <Text style={AppStyles.formLabel}>Username</Text>
                    <View style={AppStyles.authInputContainer}>
                        <User style={AppStyles.authInputIcon} color={colors.lightGray400} size={20} />
                        <TextInput
                            style={[AppStyles.formInput, AppStyles.authInput]}
                            placeholder="Enter your username"
                            value={username}
                            onChangeText={setUsername}
                            onFocus={() => setAuthError('')}
                            autoCapitalize="none"
                            placeholderTextColor={colors.lightGray400}
                        />
                    </View>
                </View>

                <View style={AppStyles.formGroup}>
                    <Text style={AppStyles.formLabel}>Password</Text>
                     <View style={AppStyles.authInputContainer}>
                        <Lock style={AppStyles.authInputIcon} color={colors.lightGray400} size={20} />
                        <TextInput
                            style={[AppStyles.formInput, AppStyles.authInput]}
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={setPassword}
                            onFocus={() => setAuthError('')}
                            secureTextEntry
                            placeholderTextColor={colors.lightGray400}
                        />
                    </View>
                </View>

                {authError ? (
                    <Text style={{color: colors.red500, textAlign: 'center', marginBottom: 16, fontSize: 16}}>
                        {authError}
                    </Text>
                ) : null}

                <TouchableOpacity
                    style={[AppStyles.btnPrimary, AppStyles.btnFull, { marginTop: 16 }]}
                    onPress={() => currentView === 'login' ? onLogin(username, password) : onRegister(username, password)}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={AppStyles.btnPrimaryText}>{currentView === 'login' ? 'Login' : 'Register'}</Text>
                    )}
                </TouchableOpacity>

                <View style={AppStyles.authSwitchContainer}>
                    <Text style={AppStyles.authSwitchText}>
                        {currentView === 'login' ? "Don't have an account?" : "Already have an account?"}
                    </Text>
                    <TouchableOpacity
                        style={AppStyles.authSwitchButton}
                        onPress={() => {
                            setCurrentView(currentView === 'login' ? 'register' : 'login');
                            setAuthError('');
                        }}
                    >
                        <Text style={AppStyles.authSwitchButtonText}>
                            {currentView === 'login' ? 'Sign Up' : 'Sign In'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default AuthScreen;
