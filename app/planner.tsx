import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    TextInput,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, X, Sparkles, Trash2 } from 'lucide-react-native';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInUp,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useProjects, formatDueDate } from '../src/context/ProjectContext';
import { ProjectCard } from '../src/components/planner/ProjectCard';
import { DashboardModal } from '../src/modals';

const AnimatedView = Animated.createAnimatedComponent(View);

// ============================================================================
// ADD PROJECT MODAL COMPONENT
// ============================================================================

interface ManualTask {
    id: string;
    title: string;
}

interface AddProjectModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (title: string, color: string, manualTasks: string[]) => void;
    onGenerateSubtasks: (title: string) => Promise<string[]>;
}

const PROJECT_COLORS = [
    '#8B5CF6', // Purple
    '#34D399', // Green
    '#60A5FA', // Blue
    '#F472B6', // Pink
    '#FBBF24', // Yellow
    '#F87171', // Red
];

const AddProjectModal: React.FC<AddProjectModalProps> = ({
    visible,
    onClose,
    onAdd,
    onGenerateSubtasks,
}) => {
    const [title, setTitle] = useState('');
    const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestedTasks, setSuggestedTasks] = useState<string[]>([]);
    const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
    const [newTaskText, setNewTaskText] = useState('');

    const handleClose = () => {
        setTitle('');
        setSelectedColor(PROJECT_COLORS[0]);
        setSuggestedTasks([]);
        setManualTasks([]);
        setNewTaskText('');
        onClose();
    };

    const handleAdd = () => {
        if (title.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const allTasks = manualTasks.map(t => t.title);
            onAdd(title.trim(), selectedColor, allTasks);
            handleClose();
        }
    };

    const handleAddManualTask = () => {
        if (newTaskText.trim()) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setManualTasks(prev => [
                ...prev,
                { id: `manual-${Date.now()}`, title: newTaskText.trim() }
            ]);
            setNewTaskText('');
        }
    };

    const handleRemoveManualTask = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setManualTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleAddSuggestedToManual = (task: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!manualTasks.find(t => t.title === task)) {
            setManualTasks(prev => [
                ...prev,
                { id: `suggested-${Date.now()}-${Math.random()}`, title: task }
            ]);
        }
    };

    const handleGenerateSubtasks = async () => {
        if (!title.trim()) return;
        setIsGenerating(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const tasks = await onGenerateSubtasks(title.trim());
            setSuggestedTasks(tasks);
        } catch (error) {
            console.error('Failed to generate subtasks:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={modalStyles.overlay}>
                <AnimatedView
                    entering={SlideInUp.duration(300).easing(Easing.out(Easing.cubic))}
                    exiting={FadeOut.duration(200)}
                    style={modalStyles.container}
                >
                    {/* Header */}
                    <View style={modalStyles.header}>
                        <Text style={modalStyles.title}>Yeni Proje</Text>
                        <TouchableOpacity onPress={handleClose} style={modalStyles.closeButton}>
                            <X size={24} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    </View>

                    {/* Title Input */}
                    <View style={modalStyles.inputContainer}>
                        <Text style={modalStyles.label}>Proje Adı</Text>
                        <TextInput
                            style={modalStyles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Örn: Bitirme Tezi"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                        />
                    </View>

                    {/* Color Picker */}
                    <View style={modalStyles.colorSection}>
                        <Text style={modalStyles.label}>Renk</Text>
                        <View style={modalStyles.colorGrid}>
                            {PROJECT_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        modalStyles.colorOption,
                                        { backgroundColor: color },
                                        selectedColor === color && modalStyles.colorSelected,
                                    ]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setSelectedColor(color);
                                    }}
                                />
                            ))}
                        </View>
                    </View>

                    {/* AI Subtask Generation */}
                    <TouchableOpacity
                        style={[
                            modalStyles.aiButton,
                            !title.trim() && { opacity: 0.5 },
                        ]}
                        onPress={handleGenerateSubtasks}
                        disabled={!title.trim() || isGenerating}
                    >
                        <Sparkles size={18} color="#FBBF24" />
                        <Text style={modalStyles.aiButtonText}>
                            {isGenerating ? 'Düşünüyorum...' : 'AI ile Görev Öner'}
                        </Text>
                    </TouchableOpacity>

                    {/* Suggested Tasks Preview */}
                    {suggestedTasks.length > 0 && (
                        <AnimatedView
                            entering={FadeIn.duration(200)}
                            style={modalStyles.suggestedContainer}
                        >
                            <Text style={modalStyles.suggestedTitle}>Önerilen Görevler (eklemek için dokun):</Text>
                            {suggestedTasks.map((task, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={modalStyles.suggestedTaskButton}
                                    onPress={() => handleAddSuggestedToManual(task)}
                                >
                                    <Plus size={14} color="#8B5CF6" />
                                    <Text style={modalStyles.suggestedTask}>{task}</Text>
                                </TouchableOpacity>
                            ))}
                        </AnimatedView>
                    )}

                    {/* Manual Task Input */}
                    <View style={modalStyles.manualTaskSection}>
                        <Text style={modalStyles.label}>Alt Görevler</Text>
                        <View style={modalStyles.manualTaskInputRow}>
                            <TextInput
                                style={modalStyles.manualTaskInput}
                                value={newTaskText}
                                onChangeText={setNewTaskText}
                                placeholder="Yeni görev ekle..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                onSubmitEditing={handleAddManualTask}
                                returnKeyType="done"
                            />
                            <TouchableOpacity
                                style={modalStyles.manualTaskAddButton}
                                onPress={handleAddManualTask}
                                disabled={!newTaskText.trim()}
                            >
                                <Plus size={20} color={newTaskText.trim() ? '#8B5CF6' : 'rgba(255,255,255,0.3)'} />
                            </TouchableOpacity>
                        </View>

                        {/* Added Tasks List */}
                        {manualTasks.length > 0 && (
                            <View style={modalStyles.manualTasksList}>
                                {manualTasks.map((task) => (
                                    <View key={task.id} style={modalStyles.manualTaskItem}>
                                        <Text style={modalStyles.manualTaskText}>{task.title}</Text>
                                        <TouchableOpacity
                                            onPress={() => handleRemoveManualTask(task.id)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Trash2 size={16} color="rgba(255,255,255,0.4)" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Add Button */}
                    <TouchableOpacity
                        style={[
                            modalStyles.addButton,
                            !title.trim() && { opacity: 0.5 },
                        ]}
                        onPress={handleAdd}
                        disabled={!title.trim()}
                    >
                        <LinearGradient
                            colors={['#8B5CF6', '#6D28D9']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={modalStyles.addButtonGradient}
                        >
                            <Text style={modalStyles.addButtonText}>Proje Oluştur</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </AnimatedView>
            </View>
        </Modal>
    );
};

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    container: {
        backgroundColor: 'rgba(30, 30, 46, 0.98)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 4,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    colorSection: {
        marginBottom: 20,
    },
    colorGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    colorOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: 'transparent',
    },
    colorSelected: {
        borderColor: '#FFFFFF',
        transform: [{ scale: 1.1 }],
    },
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
        marginBottom: 16,
    },
    aiButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FBBF24',
    },
    suggestedContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    suggestedTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: 8,
    },
    suggestedTaskButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderRadius: 8,
        marginBottom: 6,
    },
    suggestedTask: {
        fontSize: 14,
        color: '#FFFFFF',
        flex: 1,
    },
    suggestedMore: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.4)',
        marginTop: 4,
    },
    manualTaskSection: {
        marginBottom: 16,
    },
    manualTaskInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    manualTaskInput: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    manualTaskAddButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    manualTasksList: {
        marginTop: 12,
    },
    manualTaskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 6,
    },
    manualTaskText: {
        fontSize: 14,
        color: '#FFFFFF',
        flex: 1,
        marginRight: 8,
    },
    addButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    addButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

// ============================================================================
// PLANNER SCREEN
// ============================================================================

export default function PlannerScreen() {
    const router = useRouter();
    const { projects, addProject, addTask, generateSubtasks } = useProjects();
    const [expandedProject, setExpandedProject] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);

    // Sort projects by due date (earliest first, undefined dates at end)
    const sortedProjects = [...projects].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
    });

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Navigate back to home and open DashboardModal (Control Center)
        router.replace({
            pathname: '/',
            params: { openDashboard: 'true' },
        });
    };

    const handleToggleProject = (projectId: string) => {
        setExpandedProject(expandedProject === projectId ? null : projectId);
    };

    const handleAddProject = useCallback(async (title: string, color: string, manualTasks: string[]) => {
        // Use manual tasks if provided, otherwise generate with AI
        const tasks = manualTasks.length > 0
            ? manualTasks
            : await generateSubtasks(title);

        addProject({
            title,
            color,
            dueDate: undefined,
            tasks: tasks.map((taskTitle, index) => ({
                id: `new-${Date.now()}-${index}`,
                title: taskTitle,
                isCompleted: false,
            })),
        });
    }, [addProject, generateSubtasks]);

    const handleOpenAddModal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowAddModal(true);
    };

    const handleDashboardNavigate = (screen: string) => {
        setShowDashboard(false);
        router.push(`/${screen}` as any);
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
                <TouchableOpacity style={styles.addButton} onPress={handleOpenAddModal}>
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

                {/* Empty State */}
                {sortedProjects.length === 0 && (
                    <AnimatedView
                        entering={FadeIn.duration(300)}
                        style={styles.emptyState}
                    >
                        <Text style={styles.emptyStateEmoji}>📋</Text>
                        <Text style={styles.emptyStateTitle}>Henüz proje yok</Text>
                        <Text style={styles.emptyStateText}>
                            İlk projenizi ekleyerek başlayın
                        </Text>
                    </AnimatedView>
                )}

                {/* Timeline View */}
                <View style={styles.timeline}>
                    {sortedProjects.map((project, index) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            index={index}
                            isExpanded={expandedProject === project.id}
                            onToggle={() => handleToggleProject(project.id)}
                            totalProjects={sortedProjects.length}
                        />
                    ))}
                </View>

                {/* Add New Project Button */}
                <TouchableOpacity
                    style={styles.addProjectButton}
                    onPress={handleOpenAddModal}
                >
                    <Plus size={20} color="#8B5CF6" strokeWidth={2} />
                    <Text style={styles.addProjectText}>Yeni Proje Ekle</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add Project Modal */}
            <AddProjectModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddProject}
                onGenerateSubtasks={generateSubtasks}
            />

            {/* Dashboard Modal (Navigation) */}
            <DashboardModal
                visible={showDashboard}
                onClose={() => setShowDashboard(false)}
                onNavigate={handleDashboardNavigate}
            />
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
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyStateEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.5)',
        textAlign: 'center',
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
