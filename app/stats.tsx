import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, Target, Flame, TrendingUp } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedView = Animated.createAnimatedComponent(View);

// Sample stats data
const STATS = {
    todayMinutes: 45,
    weekMinutes: 210,
    totalSessions: 28,
    streak: 5,
    weeklyGoal: 300,
};

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subValue?: string;
    color: string;
    index: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, color, index }) => {
    return (
        <AnimatedView
            entering={FadeInDown.delay(index * 60).duration(300)}
            style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}
        >
            <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
                {icon}
            </View>
            <View style={styles.statInfo}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
                {subValue && <Text style={styles.statSubValue}>{subValue}</Text>}
            </View>
        </AnimatedView>
    );
};

export default function StatsScreen() {
    const router = useRouter();

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const weeklyProgress = Math.round((STATS.weekMinutes / STATS.weeklyGoal) * 100);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>İstatistikler</Text>
                <View style={styles.backButton} />
            </View>

            {/* Stats Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Weekly Progress Card */}
                <AnimatedView
                    entering={FadeInDown.duration(300)}
                    style={styles.progressCard}
                >
                    <Text style={styles.progressTitle}>Haftalık Hedef</Text>
                    <View style={styles.progressRow}>
                        <Text style={styles.progressValue}>
                            {Math.floor(STATS.weekMinutes / 60)}s {STATS.weekMinutes % 60}dk
                        </Text>
                        <Text style={styles.progressGoal}>
                            / {Math.floor(STATS.weeklyGoal / 60)} saat
                        </Text>
                    </View>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${Math.min(weeklyProgress, 100)}%` }]} />
                    </View>
                    <Text style={styles.progressPercent}>{weeklyProgress}% tamamlandı</Text>
                </AnimatedView>

                {/* Stats Grid */}
                <Text style={styles.sectionTitle}>Özet</Text>
                <View style={styles.statsGrid}>
                    <StatCard
                        icon={<Clock size={20} color="#60A5FA" strokeWidth={2} />}
                        label="Bugün"
                        value={`${STATS.todayMinutes} dk`}
                        color="#60A5FA"
                        index={0}
                    />
                    <StatCard
                        icon={<Target size={20} color="#34D399" strokeWidth={2} />}
                        label="Toplam Oturum"
                        value={`${STATS.totalSessions}`}
                        subValue="tamamlandı"
                        color="#34D399"
                        index={1}
                    />
                    <StatCard
                        icon={<Flame size={20} color="#F97316" strokeWidth={2} />}
                        label="Seri"
                        value={`${STATS.streak} gün`}
                        subValue="devam ediyor!"
                        color="#F97316"
                        index={2}
                    />
                    <StatCard
                        icon={<TrendingUp size={20} color="#A78BFA" strokeWidth={2} />}
                        label="Bu Hafta"
                        value={`${Math.floor(STATS.weekMinutes / 60)}s ${STATS.weekMinutes % 60}dk`}
                        color="#A78BFA"
                        index={3}
                    />
                </View>

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
    progressCard: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
        marginBottom: 24,
    },
    progressTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: 8,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    progressValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    progressGoal: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.5)',
        marginLeft: 8,
    },
    progressBar: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#8B5CF6',
        borderRadius: 4,
    },
    progressPercent: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    statsGrid: {
        gap: 12,
    },
    statCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    statIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    statInfo: {
        flex: 1,
    },
    statLabel: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    statSubValue: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.4)',
        marginTop: 2,
    },
});
