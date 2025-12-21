import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    Bell,
    Moon,
    Volume2,
    Globe,
    Shield,
    HelpCircle,
    ChevronRight,
    LogOut,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedView = Animated.createAnimatedComponent(View);

interface SettingItemProps {
    icon: React.ReactNode;
    label: string;
    value?: string;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    onPress?: () => void;
    index: number;
    danger?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
    icon,
    label,
    value,
    hasSwitch,
    switchValue,
    onSwitchChange,
    onPress,
    index,
    danger,
}) => {
    const handlePress = () => {
        if (onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
        }
    };

    return (
        <AnimatedView entering={FadeInDown.delay(index * 50).duration(250)}>
            <TouchableOpacity
                style={styles.settingItem}
                onPress={handlePress}
                disabled={hasSwitch}
                activeOpacity={0.7}
            >
                <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
                    {icon}
                </View>
                <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>
                        {label}
                    </Text>
                    {value && <Text style={styles.settingValue}>{value}</Text>}
                </View>
                {hasSwitch ? (
                    <Switch
                        value={switchValue}
                        onValueChange={(val) => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onSwitchChange?.(val);
                        }}
                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#8B5CF6' }}
                        thumbColor="#FFFFFF"
                    />
                ) : (
                    <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
                )}
            </TouchableOpacity>
        </AnimatedView>
    );
};

export default function SettingsScreen() {
    const router = useRouter();
    const [notifications, setNotifications] = React.useState(true);
    const [darkMode, setDarkMode] = React.useState(true);
    const [soundEffects, setSoundEffects] = React.useState(true);

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Navigate back to home and open DashboardModal (Control Center)
        router.replace({
            pathname: '/',
            params: { openDashboard: 'true' },
        });
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ayarlar</Text>
                <View style={styles.backButton} />
            </View>

            {/* Settings Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Preferences Section */}
                <Text style={styles.sectionTitle}>Tercihler</Text>
                <View style={styles.section}>
                    <SettingItem
                        icon={<Bell size={20} color="#60A5FA" strokeWidth={2} />}
                        label="Bildirimler"
                        hasSwitch
                        switchValue={notifications}
                        onSwitchChange={setNotifications}
                        index={0}
                    />
                    <SettingItem
                        icon={<Moon size={20} color="#A78BFA" strokeWidth={2} />}
                        label="Karanlık Mod"
                        hasSwitch
                        switchValue={darkMode}
                        onSwitchChange={setDarkMode}
                        index={1}
                    />
                    <SettingItem
                        icon={<Volume2 size={20} color="#34D399" strokeWidth={2} />}
                        label="Ses Efektleri"
                        hasSwitch
                        switchValue={soundEffects}
                        onSwitchChange={setSoundEffects}
                        index={2}
                    />
                    <SettingItem
                        icon={<Globe size={20} color="#F97316" strokeWidth={2} />}
                        label="Dil"
                        value="Türkçe"
                        onPress={() => { }}
                        index={3}
                    />
                </View>

                {/* Support Section */}
                <Text style={styles.sectionTitle}>Destek</Text>
                <View style={styles.section}>
                    <SettingItem
                        icon={<Shield size={20} color="#9CA3AF" strokeWidth={2} />}
                        label="Gizlilik Politikası"
                        onPress={() => router.push('/privacy')}
                        index={4}
                    />
                    <SettingItem
                        icon={<HelpCircle size={20} color="#9CA3AF" strokeWidth={2} />}
                        label="Yardım & SSS"
                        onPress={() => { }}
                        index={5}
                    />
                </View>

                {/* Account Section */}
                <Text style={styles.sectionTitle}>Hesap</Text>
                <View style={styles.section}>
                    <SettingItem
                        icon={<LogOut size={20} color="#EF4444" strokeWidth={2} />}
                        label="Çıkış Yap"
                        onPress={() => { }}
                        index={6}
                        danger
                    />
                </View>

                {/* Version */}
                <Text style={styles.version}>Minito v1.0.0</Text>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginTop: 8,
    },
    section: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        marginBottom: 24,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    settingIconDanger: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    settingInfo: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    settingLabelDanger: {
        color: '#EF4444',
    },
    settingValue: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 2,
    },
    version: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.3)',
        textAlign: 'center',
        marginTop: 8,
    },
});
