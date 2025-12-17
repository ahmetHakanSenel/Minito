import React, { useState } from 'react';
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
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Circle, CheckCircle2 } from 'lucide-react-native';
import Animated, {
    FadeInDown,
    FadeInRight,
    LinearTransition,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Sample project data
interface ProjectTask {
    id: string;
    title: string;
    completed: boolean;
}

interface Project {
    id: string;
    title: string;
    color: string;
    progress: number; // 0-100
    nextStep: string;
    dueDate?: string;
    tasks: ProjectTask[];
}

const SAMPLE_PROJECTS: Project[] = [
    {
        id: '1',
        title: 'Bitirme Tezi',
        color: '#8B5CF6',
        progress: 35,
        nextStep: 'Literatür taramasını bitir',
        dueDate: '15 Ocak 2025',
        tasks: [
            { id: '1-1', title: 'Konu belirleme', completed: true },
            { id: '1-2', title: 'Danışman ile görüşme', completed: true },
            { id: '1-3', title: 'Literatür taraması', completed: false },
            { id: '1-4', title: 'Metodoloji yazımı', completed: false },
        ],
    },
    {
        id: '2',
        title: 'Fitness Hedefi',
        color: '#34D399',
        progress: 60,
        nextStep: 'Bu hafta 3 antrenman yap',
        tasks: [
            { id: '2-1', title: 'Spor salonu üyeliği', completed: true },
            { id: '2-2', title: 'Antrenman programı oluştur', completed: true },
            { id: '2-3', title: '12 haftalık program', completed: false },
        ],
    },
    {
        id: '3',
        title: 'Yeni Dil Öğren',
        color: '#60A5FA',
        progress: 15,
        nextStep: 'Günlük 15 dakika pratik',
        tasks: [
            { id: '3-1', title: 'Uygulama indir', completed: true },
            { id: '3-2', title: 'İlk 100 kelime', completed: false },
            { id: '3-3', title: 'Temel gramer', completed: false },
        ],
    },
];

interface ProjectCardProps {
    project: Project;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, index, isExpanded, onToggle }) => {
    const scale = useSharedValue(1);

    const handlePressIn = () => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedView
            entering={FadeInRight.delay(index * 80).duration(300)}
            layout={LinearTransition.duration(200)}
            style={styles.timelineItem}
        >
            {/* Timeline connector */}
            <View style={styles.timelineConnector}>
                <View style={[styles.timelineDot, { backgroundColor: project.color }]} />
                {index < SAMPLE_PROJECTS.length - 1 && <View style={styles.timelineLine} />}
            </View>

            {/* Project Card */}
            <AnimatedTouchableOpacity
                style={[styles.projectCard, animatedStyle]}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
            >
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                        <View style={[styles.colorIndicator, { backgroundColor: project.color }]} />
                        <Text style={styles.projectTitle}>{project.title}</Text>
                    </View>
                    {isExpanded ? (
                        <ChevronUp size={20} color="rgba(255,255,255,0.5)" />
                    ) : (
                        <ChevronDown size={20} color="rgba(255,255,255,0.5)" />
                    )}
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${project.progress}%`, backgroundColor: project.color },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>{project.progress}%</Text>
                </View>

                {/* Next Step */}
                <View style={styles.nextStepContainer}>
                    <Text style={styles.nextStepLabel}>Sonraki Adım:</Text>
                    <Text style={styles.nextStepText}>{project.nextStep}</Text>
                </View>

                {/* Due Date */}
                {project.dueDate && (
                    <Text style={styles.dueDate}>Bitiş: {project.dueDate}</Text>
                )}

                {/* Expanded Tasks */}
                {isExpanded && (
                    <AnimatedView
                        entering={FadeInDown.duration(200)}
                        style={styles.tasksContainer}
                    >
                        <View style={styles.tasksDivider} />
                        <Text style={styles.tasksTitle}>Alt Görevler</Text>
                        {project.tasks.map((task) => (
                            <View key={task.id} style={styles.taskItem}>
                                {task.completed ? (
                                    <CheckCircle2 size={18} color="#34D399" strokeWidth={2} />
                                ) : (
                                    <Circle size={18} color="rgba(255,255,255,0.3)" strokeWidth={2} />
                                )}
                                <Text
                                    style={[
                                        styles.taskText,
                                        task.completed && styles.taskTextCompleted,
                                    ]}
                                >
                                    {task.title}
                                </Text>
                            </View>
                        ))}
                    </AnimatedView>
                )}
            </AnimatedTouchableOpacity>
        </AnimatedView>
    );
};

export default function PlannerScreen() {
    const router = useRouter();
    const [expandedProject, setExpandedProject] = useState<string | null>(null);

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const handleToggleProject = (projectId: string) => {
        setExpandedProject(expandedProject === projectId ? null : projectId);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Planlayıcı</Text>
                <TouchableOpacity style={styles.addButton}>
                    <Plus size={24} color="#FFFFFF" strokeWidth={2} />
                </TouchableOpacity>
            </View>

            {/* Timeline */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Section Title */}
                <Text style={styles.sectionTitle}>Aktif Projeler</Text>

                {/* Timeline View */}
                <View style={styles.timeline}>
                    {SAMPLE_PROJECTS.map((project, index) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            index={index}
                            isExpanded={expandedProject === project.id}
                            onToggle={() => handleToggleProject(project.id)}
                        />
                    ))}
                </View>

                {/* Empty state or add new */}
                <TouchableOpacity style={styles.addProjectButton}>
                    <Plus size={20} color="#8B5CF6" strokeWidth={2} />
                    <Text style={styles.addProjectText}>Yeni Proje Ekle</Text>
                </TouchableOpacity>

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
    addButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 20,
        marginLeft: 40,
    },
    timeline: {
        paddingLeft: 20,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    timelineConnector: {
        width: 20,
        alignItems: 'center',
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 20,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginTop: 4,
    },
    projectCard: {
        flex: 1,
        marginLeft: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    colorIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    projectTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        width: 36,
        textAlign: 'right',
    },
    nextStepContainer: {
        marginBottom: 8,
    },
    nextStepLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.4)',
        marginBottom: 2,
    },
    nextStepText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    dueDate: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.4)',
    },
    tasksContainer: {
        marginTop: 12,
    },
    tasksDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 12,
    },
    tasksTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: 10,
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    taskText: {
        fontSize: 14,
        color: '#FFFFFF',
    },
    taskTextCompleted: {
        color: 'rgba(255, 255, 255, 0.4)',
        textDecorationLine: 'line-through',
    },
    addProjectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        marginTop: 8,
        marginLeft: 32,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
        borderRadius: 16,
        borderStyle: 'dashed',
    },
    addProjectText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#8B5CF6',
    },
});
