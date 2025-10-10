import { Lock, Mail, User } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../AppStyles';

const AuthScreen = ({ onLogin, onRegister, authError, setAuthError, isLoading, currentView, setCurrentView }) => {
    const [email, setEmail] = useState('');
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
                    <Text style={AppStyles.formLabel}>Email</Text>
                    <View style={AppStyles.authInputContainer}>
                        <Mail style={AppStyles.authInputIcon} color={colors.lightGray400} size={20} />
                        <TextInput
                            style={[AppStyles.formInput, AppStyles.authInput]}
                            placeholder="Enter your email"
                            value={email}
                            onChangeText={setEmail}
                            onFocus={() => setAuthError('')}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            placeholderTextColor={colors.lightGray400}
                        />
                    </View>
                </View>

                {currentView === 'register' && (
                    <View style={AppStyles.formGroup}>
                        <Text style={AppStyles.formLabel}>Username</Text>
                        <View style={AppStyles.authInputContainer}>
                            <User style={AppStyles.authInputIcon} color={colors.lightGray400} size={20} />
                            <TextInput
                                style={[AppStyles.formInput, AppStyles.authInput]}
                                placeholder="Choose a username"
                                value={username}
                                onChangeText={setUsername}
                                onFocus={() => setAuthError('')}
                                autoCapitalize="none"
                                placeholderTextColor={colors.lightGray400}
                            />
                        </View>
                    </View>
                )}

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
                    onPress={() => currentView === 'login' ? onLogin(email, password) : onRegister(email, password, username)}
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
