// ============= UTILITY FUNCTIONS =============
const generateId = (parentId, index) => {
    return parentId ? `${parentId}.${index + 1}` : `${index + 1}`;
};

const generateRoadmapId = () => `roadmap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const detectNodeType = (node, level) => {
    if (node.phase) return 'phase';
    if (node.sections) return 'section-container';
    if (node.topics) return 'section';
    if (node.subtopics) return 'topic';
    return 'subtopic';
};

// ============= COPY UTILITY FUNCTIONS =============
const hasNestedChildren = (node) => {
    return node.children.some(child => child.children.length > 0);
};

const formatCopyContent = (node) => {
    if (node.children.length === 0 && node.data.details && node.data.details.length > 0) {
        let content = `${node.title}:\n`;
        node.data.details.forEach((detail, index) => {
            content += `${index + 1}. ${detail}\n`;
        });
        return content.trim();
    }
    if (node.children.length === 0) return node.title;
    if (hasNestedChildren(node)) return node.title;
    let content = `${node.title}:\n`;
    node.children.forEach((child, index) => {
        content += `${index + 1}. ${child.title}\n`;
    });
    return content.trim();
};

const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (e) {
            return false;
        }
    }
};

// ============= TREE BUILDER =============
class TreeNode {
    constructor(data, parentId = null, level = 0, index = 0) {
        this.id = data.id || generateId(parentId, index);
        this.originalId = data.id || this.id;
        this.type = detectNodeType(data, level);
        this.title = data.title || data.name || 'Untitled';
        this.data = data;
        this.level = level;
        this.children = [];
        this.completed = false;
        this.expanded = level < 2;
        this.parent = null;
        this.highlighted = false;
    }

    addChild(child) {
        child.parent = this;
        this.children.push(child);
    }

    isLeaf() {
        return this.children.length === 0;
    }

    getCompletionState() {
        if (this.isLeaf()) {
            return this.completed ? 'complete' : 'incomplete';
        }
        const states = this.children.map(c => c.getCompletionState());
        const completeCount = states.filter(s => s === 'complete').length;
        if (completeCount === 0) return 'incomplete';
        if (completeCount === states.length) return 'complete';
        return 'partial';
    }

    calculateProgress() {
        const leafNodes = [];
        const collect = (n) => {
            if (n.isLeaf()) leafNodes.push(n);
            n.children.forEach(collect);
        };
        collect(this);
        if (leafNodes.length === 0) return 0;
        const completedCount = leafNodes.filter(n => n.completed).length;
        return (completedCount / leafNodes.length) * 100;
    }

    getAllDescendants() {
        let arr = [];
        for (const child of this.children) {
            arr.push(child);
            arr = arr.concat(child.getAllDescendants());
        }
        return arr;
    }

    resetHighlight() {
        this.highlighted = false;
        this.children.forEach(child => child.resetHighlight());
    }

    hasOptionalData() {
        const data = this.data;
        return (
            (data.learningObjectives && data.learningObjectives.length > 0) ||
            (data.learningOutcomes && data.learningOutcomes.length > 0) ||
            (data.practicalAssignments && data.practicalAssignments.length > 0) ||
            (data.assessmentIdeas && data.assessmentIdeas.length > 0) ||
            (data.details && data.details.length > 0) ||
            (data.duration) ||
            (data.description)
        );
    }
}

const buildTree = (data) => {
    const root = new TreeNode(data, null, 0, 0);

    const processNode = (node, parentNode, level) => {
        if (node.sections && Array.isArray(node.sections)) {
            node.sections.forEach((section, idx) => {
                const sectionNode = new TreeNode(section, parentNode.id, level + 1, idx);
                parentNode.addChild(sectionNode);
                processNode(section, sectionNode, level + 1);
            });
        }
        if (node.topics && Array.isArray(node.topics)) {
            node.topics.forEach((topic, idx) => {
                const topicNode = new TreeNode(topic, parentNode.id, level + 1, idx);
                parentNode.addChild(topicNode);
                processNode(topic, topicNode, level + 1);
            });
        }
        if (node.subtopics && Array.isArray(node.subtopics)) {
            node.subtopics.forEach((subtopic, idx) => {
                const subtopicNode = new TreeNode(subtopic, parentNode.id, level + 1, idx);
                parentNode.addChild(subtopicNode);
                processNode(subtopic, subtopicNode, level + 1);
            });
        }
    };

    processNode(data, root, 0);
    return root;
};

// ============= STORAGE SERVICE =============
const StorageService = {
    STORAGE_KEY: 'learning_tracker_roadmaps_v1',
    LEGACY_KEY: 'learning_tracker_data_v4',

    saveRoadmaps(roadmaps) {
        try {
            const data = roadmaps.map(roadmap => ({
                id: roadmap.id,
                name: roadmap.name,
                phases: roadmap.phases.map(phase => ({
                    data: phase.data,
                    completionMap: this.serializeCompletionMap(phase.root)
                }))
            }));
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving roadmaps:', error);
            return false;
        }
    },

    loadRoadmaps() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) return JSON.parse(data);
            // Migrate legacy format
            const legacyData = localStorage.getItem(this.LEGACY_KEY);
            if (legacyData) {
                const phases = JSON.parse(legacyData);
                if (phases && phases.length > 0) {
                    return [{ id: generateRoadmapId(), name: 'My Roadmap', phases }];
                }
            }
            return [];
        } catch (error) {
            console.error('Error loading roadmaps:', error);
            return [];
        }
    },

    serializeCompletionMap(node) {
        const map = {};
        const traverse = (n) => {
            map[n.id] = { completed: n.completed, expanded: n.expanded };
            n.children.forEach(traverse);
        };
        traverse(node);
        return map;
    },

    applyCompletionMap(node, map) {
        const apply = (n) => {
            if (map[n.id]) {
                n.completed = map[n.id].completed;
                n.expanded = map[n.id].expanded;
            }
            n.children.forEach(apply);
        };
        apply(node);
    },

    exportProgress(roadmaps) {
        return {
            version: '5.0',
            exportDate: new Date().toISOString(),
            roadmaps: roadmaps.map(roadmap => ({
                id: roadmap.id,
                name: roadmap.name,
                phases: roadmap.phases.map(phase => ({
                    data: phase.data,
                    completionMap: this.serializeCompletionMap(phase.root)
                }))
            }))
        };
    },

    validateImport(importData) {
        if (!importData || typeof importData !== 'object') {
            throw new Error('Invalid import data');
        }
        if (importData.roadmaps && Array.isArray(importData.roadmaps)) {
            return { type: 'roadmaps', data: importData.roadmaps };
        }
        if (importData.phases && Array.isArray(importData.phases)) {
            importData.phases.forEach((phase, index) => {
                if (!phase.data) throw new Error(`Phase ${index + 1} is missing data`);
                if (!phase.data.phase || !phase.data.title) throw new Error(`Phase ${index + 1} is missing required fields`);
            });
            return { type: 'phases', data: importData.phases };
        }
        throw new Error('Import data must contain a roadmaps or phases array');
    },

    countNodes(node) {
        let count = 1;
        node.children.forEach(child => { count += this.countNodes(child); });
        return count;
    },

    countCompletedNodes(node) {
        let count = node.completed ? 1 : 0;
        node.children.forEach(child => { count += this.countCompletedNodes(child); });
        return count;
    },

    clearAllProgress() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem(this.LEGACY_KEY);
            return true;
        } catch (error) {
            console.error('Error clearing progress:', error);
            return false;
        }
    }
};

// ============= INFO MODAL COMPONENT =============
const InfoModal = ({ isOpen, onClose, node }) => {
    if (!isOpen || !node) return null;

    const data = node.data;
    const hasLearningObjectives = data.learningObjectives && data.learningObjectives.length > 0;
    const hasLearningOutcomes = data.learningOutcomes && data.learningOutcomes.length > 0;
    const hasPracticalAssignments = data.practicalAssignments && data.practicalAssignments.length > 0;
    const hasAssessmentIdeas = data.assessmentIdeas && data.assessmentIdeas.length > 0;
    const hasDetails = data.details && data.details.length > 0;
    const hasDuration = data.duration;
    const hasDescription = data.description;

    return (
        <div className="info-modal-overlay" onClick={onClose}>
            <div className="info-modal" onClick={(e) => e.stopPropagation()}>
                <div className="info-modal-header">
                    <h3 className="info-modal-title">
                        <i className={`fas fa-${
                            node.type === 'phase' ? 'layer-group' :
                            node.type === 'section' ? 'folder' :
                            node.type === 'topic' ? 'book' :
                            'bookmark'
                        }`}></i>
                        {node.title}
                    </h3>
                    <button className="info-modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="info-modal-body">
                    {hasDuration && (
                        <div className="info-section">
                            <div className="info-section-title">
                                <i className="fas fa-clock"></i> Duration
                            </div>
                            <div className="info-text">{data.duration}</div>
                        </div>
                    )}
                    {hasDescription && (
                        <div className="info-section">
                            <div className="info-section-title">
                                <i className="fas fa-info-circle"></i> Description
                            </div>
                            <div className="info-text">{data.description}</div>
                        </div>
                    )}
                    {hasDetails && (
                        <div className="info-section">
                            <div className="info-section-title">
                                <i className="fas fa-list-ul"></i> Details
                            </div>
                            <ul className="info-list">
                                {data.details.map((detail, idx) => (
                                    <li key={idx} className="info-list-item">{detail}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {hasLearningObjectives && (
                        <div className="info-section">
                            <div className="info-section-title">
                                <i className="fas fa-bullseye"></i> Learning Objectives
                            </div>
                            <ul className="info-list">
                                {data.learningObjectives.map((objective, idx) => (
                                    <li key={idx} className="info-list-item">{objective}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {hasLearningOutcomes && (
                        <div className="info-section">
                            <div className="info-section-title">
                                <i className="fas fa-trophy"></i> Learning Outcomes
                            </div>
                            <ul className="info-list">
                                {data.learningOutcomes.map((outcome, idx) => (
                                    <li key={idx} className="info-list-item">{outcome}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {hasPracticalAssignments && (
                        <div className="info-section">
                            <div className="info-section-title">
                                <i className="fas fa-tasks"></i> Practical Assignments
                            </div>
                            <ul className="info-list">
                                {data.practicalAssignments.map((assignment, idx) => (
                                    <li key={idx} className="info-list-item">{assignment}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {hasAssessmentIdeas && (
                        <div className="info-section">
                            <div className="info-section-title">
                                <i className="fas fa-clipboard-check"></i> Assessment Ideas
                            </div>
                            <ul className="info-list">
                                {data.assessmentIdeas.map((idea, idx) => (
                                    <li key={idx} className="info-list-item">{idea}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============= EDIT MODAL COMPONENT =============
const EditModal = ({ isOpen, onClose, node, onSave }) => {
    const [editedTitle, setEditedTitle] = React.useState('');
    const [showConfirmation, setShowConfirmation] = React.useState(false);

    React.useEffect(() => {
        if (node) setEditedTitle(node.title);
    }, [node]);

    if (!isOpen || !node) return null;

    const handleSave = () => setShowConfirmation(true);

    const handleConfirmSave = () => {
        if (editedTitle.trim() && editedTitle !== node.title) {
            onSave(node, editedTitle.trim());
            setShowConfirmation(false);
            onClose();
        } else if (editedTitle.trim() === node.title) {
            setShowConfirmation(false);
            onClose();
        }
    };

    const handleCancel = () => {
        setEditedTitle(node.title);
        setShowConfirmation(false);
        onClose();
    };

    const hasChanged = editedTitle.trim() !== node.title;

    return (
        <>
            <div className="edit-modal-overlay" onClick={handleCancel}>
                <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="edit-modal-header">
                        <h3 className="edit-modal-title">
                            <i className="fas fa-edit"></i> Edit Node
                        </h3>
                        <button className="edit-modal-close" onClick={handleCancel}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="edit-modal-body">
                        <div className="edit-form-group">
                            <label className="edit-form-label">Node Title</label>
                            <input
                                type="text"
                                className="edit-form-input"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                placeholder="Enter node title"
                                autoFocus
                            />
                            <div className="edit-original-value">
                                <span className="edit-original-label">Original:</span>
                                {node.title}
                            </div>
                        </div>
                    </div>
                    <div className="edit-modal-footer">
                        <button className="btn btn-secondary" onClick={handleCancel}>
                            <i className="fas fa-times"></i> Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={!editedTitle.trim() || !hasChanged}
                        >
                            <i className="fas fa-save"></i> Save Changes
                        </button>
                    </div>
                </div>
            </div>
            {showConfirmation && (
                <div className="modal-overlay" onClick={() => setShowConfirmation(false)} style={{ zIndex: 4000 }}>
                    <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Confirm Edit</h3>
                            <button className="modal-close" onClick={() => setShowConfirmation(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Are you sure you want to update this node?
                            </p>
                            <div style={{ background: 'var(--bg-card)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ marginBottom: 'var(--space-sm)' }}>
                                    <strong style={{ color: 'var(--text-muted)' }}>From:</strong>
                                    <div style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>{node.title}</div>
                                </div>
                                <div>
                                    <strong style={{ color: 'var(--text-muted)' }}>To:</strong>
                                    <div style={{ color: 'var(--primary)', marginTop: 'var(--space-xs)' }}>{editedTitle.trim()}</div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowConfirmation(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleConfirmSave}>
                                <i className="fas fa-check"></i> Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ============= REACT COMPONENTS =============
const TreeNodeComponent = ({ node, onToggle, onCheck, searchTerm, onCopy, onShowInfo, onEdit }) => {
    const [copyState, setCopyState] = React.useState('default');

    const handleToggle = (e) => {
        e.stopPropagation();
        if (onToggle && node.children.length > 0) onToggle(node, !node.expanded);
    };

    const handleCheck = (e) => {
        e.stopPropagation();
        if (onCheck) onCheck(node);
    };

    const handleCopy = async (e) => {
        e.stopPropagation();
        const content = formatCopyContent(node);
        const success = await copyToClipboard(content);
        if (success) {
            setCopyState('copied');
            if (onCopy) onCopy('success', `Copied: ${node.title}`);
            setTimeout(() => setCopyState('default'), 2000);
        } else {
            setCopyState('error');
            if (onCopy) onCopy('error', 'Failed to copy to clipboard');
            setTimeout(() => setCopyState('default'), 2000);
        }
    };

    const handleShowInfo = (e) => {
        e.stopPropagation();
        if (onShowInfo) onShowInfo(node);
    };

    const handleEdit = (e) => {
        e.stopPropagation();
        if (onEdit) onEdit(node);
    };

    const completionState = node.getCompletionState();
    const progress = node.calculateProgress();
    const shouldHighlight = searchTerm && node.title.toLowerCase().includes(searchTerm.toLowerCase());

    const getCheckboxClass = () => {
        if (completionState === 'complete') return 'checked';
        if (completionState === 'partial') return 'partial';
        return '';
    };

    const getCopyIcon = () => {
        if (copyState === 'copied') return 'fa-check';
        if (copyState === 'error') return 'fa-exclamation';
        return 'fa-copy';
    };

    const hasInfo = node.hasOptionalData();

    return (
        <div className="tree-node" data-node-id={node.id}>
            <div className="node-wrapper">
                <div className={`node-header ${shouldHighlight ? 'highlighted' : ''} ${node.highlighted ? 'highlighted' : ''}`}>
                    <div className="node-left">
                        <button
                            className={`node-toggle ${node.children.length === 0 ? 'disabled' : ''}`}
                            onClick={handleToggle}
                            disabled={node.children.length === 0}
                        >
                            {node.children.length > 0 && (
                                <i className={`fas fa-chevron-${node.expanded ? 'down' : 'right'}`}></i>
                            )}
                        </button>
                        <div className="node-checkbox" onClick={handleCheck}>
                            <div className={`custom-checkbox ${getCheckboxClass()}`}>
                                {completionState === 'complete' && <i className="fas fa-check"></i>}
                                {completionState === 'partial' && <i className="fas fa-minus"></i>}
                            </div>
                        </div>
                        <div className="node-content">
                            <div className="node-title">{node.title}</div>
                            <div className="node-meta">
                                <span className="node-badge">
                                    <i className={`fas fa-${
                                        node.type === 'phase' ? 'layer-group' :
                                        node.type === 'section' ? 'folder' :
                                        node.type === 'topic' ? 'book' :
                                        'bookmark'
                                    }`}></i>
                                    {node.type}
                                </span>
                                {node.children.length > 0 && (
                                    <span className="node-badge">{node.children.length} items</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="node-right">
                        <div className="node-action-buttons">
                            <button
                                className="node-action-btn node-edit-icon"
                                onClick={handleEdit}
                                title="Edit node"
                            >
                                <i className="fas fa-edit"></i>
                            </button>
                            {hasInfo && (
                                <button
                                    className="node-action-btn node-info-icon"
                                    onClick={handleShowInfo}
                                    title="View details"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                            )}
                            <button
                                className={`node-copy-btn ${copyState === 'copied' ? 'copied' : ''}`}
                                onClick={handleCopy}
                                title={copyState === 'copied' ? 'Copied!' : 'Copy to clipboard'}
                            >
                                <i className={`fas ${getCopyIcon()}`}></i>
                            </button>
                        </div>
                        {node.children.length > 0 && (
                            <>
                                <div className="progress-bar-container">
                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                </div>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    {progress.toFixed(0)}%
                                </span>
                            </>
                        )}
                    </div>
                </div>
                {node.expanded && node.children.length > 0 && (
                    <div className="node-children">
                        {node.children.map((child) => (
                            <TreeNodeComponent
                                key={child.id}
                                node={child}
                                onToggle={onToggle}
                                onCheck={onCheck}
                                searchTerm={searchTerm}
                                onCopy={onCopy}
                                onShowInfo={onShowInfo}
                                onEdit={onEdit}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const ProgressCircle = ({ progress, size = 160 }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="progress-circle-container">
            <svg width={size} height={size}>
                <circle className="progress-circle-bg" cx={size / 2} cy={size / 2} r={radius} />
                <circle
                    className="progress-circle-fill"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="progress-text">
                <div className="progress-percent">{progress.toFixed(0)}%</div>
                <div className="progress-label">Completed</div>
            </div>
        </div>
    );
};

const PhaseListItem = ({ phase, index, isActive, onClick, onDelete, onRename, onEdit }) => {
    const progress = phase.root.calculateProgress();
    return (
        <div className={`phase-item ${isActive ? 'active' : ''}`} onClick={() => onClick(index)}>
            <div className="phase-info">
                <div className="phase-name">{phase.data.phase}</div>
                <div className="phase-title">{phase.data.title}</div>
            </div>
            <div className="phase-progress">
                <div className="phase-percent">{progress.toFixed(0)}%</div>
                <div className="phase-status">
                    {phase.root.getCompletionState() === 'complete' ? 'Complete' :
                     phase.root.getCompletionState() === 'partial' ? 'In Progress' : 'Not Started'}
                </div>
            </div>
            <button
                className="phase-delete"
                style={{ color: 'var(--secondary)' }}
                onClick={(e) => { e.stopPropagation(); onEdit(index); }}
                title="Edit phase structure"
            >
                <i className="fas fa-edit"></i>
            </button>
            <button
                className="phase-delete"
                style={{ color: 'var(--primary)' }}
                onClick={(e) => { e.stopPropagation(); onRename(index); }}
                title="Rename this phase"
            >
                <i className="fas fa-pen"></i>
            </button>
            <button
                className="phase-delete"
                onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                title="Delete this phase"
            >
                <i className="fas fa-trash"></i>
            </button>
        </div>
    );
};

// ============= ROADMAP LIST ITEM =============
const RoadmapListItem = ({ roadmap, isActive, onClick, onDelete }) => {
    const getAllLeafNodes = (phases) => {
        const leafNodes = [];
        const collect = (n) => { if (n.isLeaf()) leafNodes.push(n); n.children.forEach(collect); };
        phases.forEach(phase => collect(phase.root));
        return leafNodes;
    };

    const leafNodes = getAllLeafNodes(roadmap.phases);
    const completedCount = leafNodes.filter(n => n.completed).length;
    const progress = leafNodes.length > 0 ? (completedCount / leafNodes.length) * 100 : 0;
    const totalPhases = roadmap.phases.length;

    return (
        <div className={`phase-item ${isActive ? 'active' : ''}`} onClick={() => onClick(roadmap.id)}>
            <div className="phase-info">
                <div className="phase-name">{roadmap.name}</div>
                <div className="phase-title">
                    {totalPhases} phase{totalPhases !== 1 ? 's' : ''} · {progress.toFixed(0)}% done
                </div>
            </div>
            <div className="phase-progress">
                <div className="phase-percent">{progress.toFixed(0)}%</div>
                <div className="phase-status">
                    {progress === 100 && leafNodes.length > 0 ? 'Complete' :
                     progress > 0 ? 'In Progress' : 'Not Started'}
                </div>
            </div>
            <button
                className="phase-delete"
                onClick={(e) => { e.stopPropagation(); onDelete(roadmap.id); }}
                title="Delete this roadmap"
            >
                <i className="fas fa-trash"></i>
            </button>
        </div>
    );
};

// ============= CREATE ROADMAP MODAL =============
const CreateRoadmapModal = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = React.useState('');

    if (!isOpen) return null;

    const handleCreate = () => {
        if (name.trim()) {
            onCreate(name.trim());
            setName('');
            onClose();
        }
    };

    const handleClose = () => {
        setName('');
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleCreate();
        if (e.key === 'Escape') handleClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <i className="fas fa-map" style={{ marginRight: '0.5rem', color: 'var(--primary)' }}></i>
                        New Roadmap
                    </h3>
                    <button className="modal-close" onClick={handleClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                        Roadmap Name
                    </label>
                    <input
                        type="text"
                        className="edit-form-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g. Web Development, Data Science, DevOps..."
                        autoFocus
                    />
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <i className="fas fa-info-circle" style={{ marginRight: '0.375rem' }}></i>
                        Each roadmap is an independent learning journey with its own phases and progress.
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={handleClose}>
                        <i className="fas fa-times"></i> Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleCreate} disabled={!name.trim()}>
                        <i className="fas fa-plus"></i> Create Roadmap
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============= RENAME ROADMAP MODAL =============
const RenameRoadmapModal = ({ isOpen, onClose, onRename, currentName }) => {
    const [name, setName] = React.useState('');

    React.useEffect(() => {
        if (isOpen) setName(currentName || '');
    }, [isOpen, currentName]);

    if (!isOpen) return null;

    const handleRename = () => {
        if (name.trim() && name.trim() !== currentName) {
            onRename(name.trim());
            onClose();
        } else if (name.trim() === currentName) {
            onClose();
        }
    };

    const handleClose = () => { setName(''); onClose(); };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <i className="fas fa-pen" style={{ marginRight: '0.5rem', color: 'var(--primary)' }}></i>
                        Rename Roadmap
                    </h3>
                    <button className="modal-close" onClick={handleClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                        New Name
                    </label>
                    <input
                        type="text"
                        className="edit-form-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') handleClose(); }}
                        autoFocus
                    />
                    <div className="edit-original-value" style={{ marginTop: '0.5rem' }}>
                        <span className="edit-original-label">Current:</span> {currentName}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleRename} disabled={!name.trim()}>
                        <i className="fas fa-save"></i> Rename
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============= BUILD PHASE MODAL (NEW) =============
const BuildPhaseModal = ({ isOpen, onClose, onCreate }) => {
    const idRef = React.useRef(1000);
    const newId = () => `bn-${idRef.current++}`;

    const makeNode = () => ({ id: newId(), title: '', children: [] });

    const [phaseName, setPhaseName] = React.useState('');
    const [phaseTitle, setPhaseTitle] = React.useState('');
    const [sections, setSections] = React.useState([makeNode()]);

    React.useEffect(() => {
        if (!isOpen) {
            idRef.current = 1000;
            setPhaseName('');
            setPhaseTitle('');
            setSections([makeNode()]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // --- Section operations ---
    const addSection = () => setSections(prev => [...prev, makeNode()]);
    const removeSection = (sid) => setSections(prev => prev.filter(s => s.id !== sid));
    const updateSection = (sid, title) =>
        setSections(prev => prev.map(s => s.id === sid ? { ...s, title } : s));

    // --- Topic operations ---
    const addTopic = (sid) =>
        setSections(prev => prev.map(s =>
            s.id === sid ? { ...s, children: [...s.children, makeNode()] } : s
        ));
    const removeTopic = (sid, tid) =>
        setSections(prev => prev.map(s =>
            s.id === sid ? { ...s, children: s.children.filter(t => t.id !== tid) } : s
        ));
    const updateTopic = (sid, tid, title) =>
        setSections(prev => prev.map(s =>
            s.id === sid
                ? { ...s, children: s.children.map(t => t.id === tid ? { ...t, title } : t) }
                : s
        ));

    // --- Subtopic operations ---
    const addSubtopic = (sid, tid) =>
        setSections(prev => prev.map(s =>
            s.id === sid
                ? {
                    ...s, children: s.children.map(t =>
                        t.id === tid
                            ? { ...t, children: [...(t.children || []), makeNode()] }
                            : t
                    )
                }
                : s
        ));
    const removeSubtopic = (sid, tid, stid) =>
        setSections(prev => prev.map(s =>
            s.id === sid
                ? {
                    ...s, children: s.children.map(t =>
                        t.id === tid
                            ? { ...t, children: (t.children || []).filter(st => st.id !== stid) }
                            : t
                    )
                }
                : s
        ));
    const updateSubtopic = (sid, tid, stid, title) =>
        setSections(prev => prev.map(s =>
            s.id === sid
                ? {
                    ...s, children: s.children.map(t =>
                        t.id === tid
                            ? {
                                ...t, children: (t.children || []).map(st =>
                                    st.id === stid ? { ...st, title } : st
                                )
                            }
                            : t
                    )
                }
                : s
        ));

    const canCreate = phaseName.trim() && sections.some(s => s.title.trim());

    const handleCreate = () => {
        if (!canCreate) return;
        const phaseData = {
            phase: phaseName.trim(),
            title: phaseTitle.trim() || phaseName.trim(),
            sections: sections
                .filter(s => s.title.trim())
                .map(s => ({
                    title: s.title.trim(),
                    topics: (s.children || [])
                        .filter(t => t.title.trim())
                        .map(t => ({
                            title: t.title.trim(),
                            subtopics: (t.children || [])
                                .filter(st => st.title.trim())
                                .map(st => ({ title: st.title.trim() }))
                        }))
                }))
        };
        onCreate(phaseData);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal build-phase-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <i className="fas fa-sitemap" style={{ marginRight: '0.5rem', color: 'var(--primary)' }}></i>
                        Build Learning Phase
                    </h3>
                    <button className="modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body build-phase-modal-body">
                    {/* Phase Info */}
                    <div className="build-phase-info-row">
                        <div>
                            <label className="edit-form-label">Phase Name <span style={{ color: 'var(--error)' }}>*</span></label>
                            <input
                                className="edit-form-input"
                                placeholder="e.g. Phase 1, Foundation, Advanced..."
                                value={phaseName}
                                onChange={e => setPhaseName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="edit-form-label">Phase Description</label>
                            <input
                                className="edit-form-input"
                                placeholder="e.g. Introduction to core concepts..."
                                value={phaseTitle}
                                onChange={e => setPhaseTitle(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="build-phase-legend">
                        <div className="build-legend-item">
                            <i className="fas fa-folder" style={{ color: 'var(--primary)' }}></i>
                            <span>Section</span>
                        </div>
                        <div className="build-legend-item">
                            <i className="fas fa-book" style={{ color: 'var(--accent)' }}></i>
                            <span>Topic</span>
                        </div>
                        <div className="build-legend-item">
                            <i className="fas fa-bookmark" style={{ color: 'var(--secondary)' }}></i>
                            <span>Subtopic</span>
                        </div>
                    </div>

                    {/* Tree Builder */}
                    <div style={{ marginBottom: '0.5rem' }}>
                        <div className="build-phase-tree-header">
                            <label className="edit-form-label" style={{ margin: 0 }}>
                                <i className="fas fa-sitemap" style={{ marginRight: '0.375rem', color: 'var(--primary)' }}></i>
                                Roadmap Structure
                            </label>
                            <button
                                className="btn btn-secondary"
                                onClick={addSection}
                                style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
                            >
                                <i className="fas fa-plus"></i> Add Section
                            </button>
                        </div>

                        {sections.length === 0 ? (
                            <div className="build-phase-empty">
                                <i className="fas fa-plus-circle" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block', opacity: 0.4 }}></i>
                                Click "Add Section" to start building your roadmap structure
                            </div>
                        ) : (
                            <div className="build-phase-sections">
                                {sections.map((section, si) => (
                                    <div key={section.id} className="builder-section-card">
                                        {/* Section Row */}
                                        <div className="builder-row">
                                            <i className="fas fa-folder builder-icon" style={{ color: 'var(--primary)' }}></i>
                                            <input
                                                className="edit-form-input builder-input"
                                                placeholder={`Section ${si + 1} — e.g. Getting Started, Core Concepts...`}
                                                value={section.title}
                                                onChange={e => updateSection(section.id, e.target.value)}
                                            />
                                            <button
                                                className="btn btn-secondary builder-add-btn"
                                                onClick={() => addTopic(section.id)}
                                                title="Add a topic under this section"
                                            >
                                                <i className="fas fa-plus"></i> Topic
                                            </button>
                                            <button
                                                className="phase-delete"
                                                onClick={() => removeSection(section.id)}
                                                title="Remove section"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>

                                        {/* Topics */}
                                        {section.children.length > 0 && (
                                            <div className="builder-children">
                                                {section.children.map((topic, ti) => (
                                                    <div key={topic.id}>
                                                        {/* Topic Row */}
                                                        <div className="builder-row builder-topic-row">
                                                            <i className="fas fa-book builder-icon" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}></i>
                                                            <input
                                                                className="edit-form-input builder-input"
                                                                placeholder={`Topic ${ti + 1} — e.g. Variables, Functions...`}
                                                                value={topic.title}
                                                                onChange={e => updateTopic(section.id, topic.id, e.target.value)}
                                                                style={{ fontSize: '0.875rem', padding: '0.45rem 0.75rem' }}
                                                            />
                                                            <button
                                                                className="btn btn-secondary builder-add-btn"
                                                                onClick={() => addSubtopic(section.id, topic.id)}
                                                                title="Add a subtopic"
                                                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                                                            >
                                                                <i className="fas fa-plus"></i> Sub
                                                            </button>
                                                            <button
                                                                className="phase-delete"
                                                                onClick={() => removeTopic(section.id, topic.id)}
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>

                                                        {/* Subtopics */}
                                                        {(topic.children || []).length > 0 && (
                                                            <div className="builder-children builder-subtopics">
                                                                {topic.children.map((subtopic, sti) => (
                                                                    <div key={subtopic.id} className="builder-row builder-subtopic-row">
                                                                        <i className="fas fa-bookmark builder-icon" style={{ color: 'var(--secondary)', fontSize: '0.75rem' }}></i>
                                                                        <input
                                                                            className="edit-form-input builder-input"
                                                                            placeholder={`Subtopic ${sti + 1}...`}
                                                                            value={subtopic.title}
                                                                            onChange={e => updateSubtopic(section.id, topic.id, subtopic.id, e.target.value)}
                                                                            style={{ fontSize: '0.8rem', padding: '0.375rem 0.625rem' }}
                                                                        />
                                                                        <button
                                                                            className="phase-delete"
                                                                            onClick={() => removeSubtopic(section.id, topic.id, subtopic.id)}
                                                                        >
                                                                            <i className="fas fa-trash"></i>
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tip */}
                    <div className="build-phase-tip">
                        <i className="fas fa-lightbulb" style={{ color: 'var(--accent)', marginRight: '0.375rem' }}></i>
                        <span>Tip: Sections group related topics together. Topics can contain subtopics for deeper breakdowns. Empty nodes are skipped.</span>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        <i className="fas fa-times"></i> Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleCreate} disabled={!canCreate}>
                        <i className="fas fa-check"></i> Create Phase
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============= EDIT PHASE MODAL =============
const EditPhaseModal = ({ isOpen, onClose, onSave, phase, phaseIndex }) => {
    const idRef = React.useRef(9000);
    const newId = () => `ep-${idRef.current++}`;

    const [phaseName, setPhaseName]   = React.useState('');
    const [phaseTitle, setPhaseTitle] = React.useState('');
    const [sections, setSections]     = React.useState([]);

    // Convert a phase's raw data object into the builder's internal node format
    const dataToBuilderSections = (phaseData) => {
        idRef.current = 9000;
        const raw = phaseData.sections || [];
        if (raw.length === 0) {
            return [{ id: newId(), title: '', children: [] }];
        }
        return raw.map(section => ({
            id: newId(),
            title: section.title || '',
            children: (section.topics || []).map(topic => ({
                id: newId(),
                title: topic.title || '',
                children: (topic.subtopics || []).map(sub => ({
                    id: newId(),
                    title: sub.title || '',
                    children: []
                }))
            }))
        }));
    };

    // Populate from phase data every time the modal opens for a phase
    React.useEffect(() => {
        if (isOpen && phase) {
            setPhaseName(phase.data.phase || '');
            setPhaseTitle(phase.data.title || '');
            setSections(dataToBuilderSections(phase.data));
        }
    }, [isOpen, phaseIndex]); // re-run when phaseIndex changes so different phases load correctly

    if (!isOpen || phase == null) return null;

    const makeNode = () => ({ id: newId(), title: '', children: [] });

    // ---- Section operations ----
    const addSection = () =>
        setSections(prev => [...prev, makeNode()]);

    const removeSection = (sid) =>
        setSections(prev => prev.filter(s => s.id !== sid));

    const updateSection = (sid, title) =>
        setSections(prev => prev.map(s => s.id === sid ? { ...s, title } : s));

    // ---- Topic operations ----
    const addTopic = (sid) =>
        setSections(prev => prev.map(s =>
            s.id === sid ? { ...s, children: [...s.children, makeNode()] } : s
        ));

    const removeTopic = (sid, tid) =>
        setSections(prev => prev.map(s =>
            s.id === sid ? { ...s, children: s.children.filter(t => t.id !== tid) } : s
        ));

    const updateTopic = (sid, tid, title) =>
        setSections(prev => prev.map(s =>
            s.id === sid
                ? { ...s, children: s.children.map(t => t.id === tid ? { ...t, title } : t) }
                : s
        ));

    // ---- Subtopic operations ----
    const addSubtopic = (sid, tid) =>
        setSections(prev => prev.map(s =>
            s.id === sid
                ? { ...s, children: s.children.map(t =>
                    t.id === tid
                        ? { ...t, children: [...(t.children || []), makeNode()] }
                        : t
                  ) }
                : s
        ));

    const removeSubtopic = (sid, tid, stid) =>
        setSections(prev => prev.map(s =>
            s.id === sid
                ? { ...s, children: s.children.map(t =>
                    t.id === tid
                        ? { ...t, children: (t.children || []).filter(st => st.id !== stid) }
                        : t
                  ) }
                : s
        ));

    const updateSubtopic = (sid, tid, stid, title) =>
        setSections(prev => prev.map(s =>
            s.id === sid
                ? { ...s, children: s.children.map(t =>
                    t.id === tid
                        ? { ...t, children: (t.children || []).map(st =>
                            st.id === stid ? { ...st, title } : st
                          ) }
                        : t
                  ) }
                : s
        ));

    const canSave = phaseName.trim() && sections.some(s => s.title.trim());

    const handleSave = () => {
        if (!canSave) return;
        const phaseData = {
            phase: phaseName.trim(),
            title: phaseTitle.trim() || phaseName.trim(),
            sections: sections
                .filter(s => s.title.trim())
                .map(s => ({
                    title: s.title.trim(),
                    topics: (s.children || [])
                        .filter(t => t.title.trim())
                        .map(t => ({
                            title: t.title.trim(),
                            subtopics: (t.children || [])
                                .filter(st => st.title.trim())
                                .map(st => ({ title: st.title.trim() }))
                        }))
                }))
        };
        onSave(phaseData, phaseIndex);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal build-phase-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="modal-header">
                    <h3 className="modal-title">
                        <i className="fas fa-edit" style={{ marginRight: '0.5rem', color: 'var(--secondary)' }}></i>
                        Edit Phase Structure
                    </h3>
                    <button className="modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="modal-body build-phase-modal-body">

                    {/* Phase name + description */}
                    <div className="build-phase-info-row">
                        <div>
                            <label className="edit-form-label">
                                Phase Name <span style={{ color: 'var(--error)' }}>*</span>
                            </label>
                            <input
                                className="edit-form-input"
                                placeholder="e.g. Phase 1, Foundation, Advanced..."
                                value={phaseName}
                                onChange={e => setPhaseName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="edit-form-label">Phase Description</label>
                            <input
                                className="edit-form-input"
                                placeholder="e.g. Introduction to core concepts..."
                                value={phaseTitle}
                                onChange={e => setPhaseTitle(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="build-phase-legend">
                        <div className="build-legend-item">
                            <i className="fas fa-folder" style={{ color: 'var(--primary)' }}></i>
                            <span>Section</span>
                        </div>
                        <div className="build-legend-item">
                            <i className="fas fa-book" style={{ color: 'var(--accent)' }}></i>
                            <span>Topic</span>
                        </div>
                        <div className="build-legend-item">
                            <i className="fas fa-bookmark" style={{ color: 'var(--secondary)' }}></i>
                            <span>Subtopic</span>
                        </div>
                    </div>

                    {/* Warning about progress */}
                    <div
                        className="build-phase-tip"
                        style={{
                            borderColor: 'rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.07)',
                            marginBottom: '0.75rem'
                        }}
                    >
                        <i className="fas fa-exclamation-triangle" style={{ color: 'var(--error)', marginRight: '0.375rem' }}></i>
                        <span>
                            Note: Removing or reordering items will reset their completion progress.
                            Items that stay in the same position keep their progress.
                        </span>
                    </div>

                    {/* Tree builder */}
                    <div style={{ marginBottom: '0.5rem' }}>
                        <div className="build-phase-tree-header">
                            <label className="edit-form-label" style={{ margin: 0 }}>
                                <i className="fas fa-sitemap" style={{ marginRight: '0.375rem', color: 'var(--primary)' }}></i>
                                Phase Structure
                            </label>
                            <button
                                className="btn btn-secondary"
                                onClick={addSection}
                                style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
                            >
                                <i className="fas fa-plus"></i> Add Section
                            </button>
                        </div>

                        {sections.length === 0 ? (
                            <div className="build-phase-empty">
                                <i className="fas fa-plus-circle" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block', opacity: 0.4 }}></i>
                                Click "Add Section" to add content to this phase
                            </div>
                        ) : (
                            <div className="build-phase-sections">
                                {sections.map((section, si) => (
                                    <div key={section.id} className="builder-section-card">

                                        {/* Section row */}
                                        <div className="builder-row">
                                            <i className="fas fa-folder builder-icon" style={{ color: 'var(--primary)' }}></i>
                                            <input
                                                className="edit-form-input builder-input"
                                                placeholder={`Section ${si + 1} — e.g. Getting Started, Core Concepts...`}
                                                value={section.title}
                                                onChange={e => updateSection(section.id, e.target.value)}
                                            />
                                            <button
                                                className="btn btn-secondary builder-add-btn"
                                                onClick={() => addTopic(section.id)}
                                                title="Add a topic under this section"
                                            >
                                                <i className="fas fa-plus"></i> Topic
                                            </button>
                                            <button
                                                className="phase-delete"
                                                onClick={() => removeSection(section.id)}
                                                title="Remove section"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>

                                        {/* Topics */}
                                        {section.children.length > 0 && (
                                            <div className="builder-children">
                                                {section.children.map((topic, ti) => (
                                                    <div key={topic.id}>

                                                        {/* Topic row */}
                                                        <div className="builder-row builder-topic-row">
                                                            <i className="fas fa-book builder-icon" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}></i>
                                                            <input
                                                                className="edit-form-input builder-input"
                                                                placeholder={`Topic ${ti + 1} — e.g. Variables, Functions...`}
                                                                value={topic.title}
                                                                onChange={e => updateTopic(section.id, topic.id, e.target.value)}
                                                                style={{ fontSize: '0.875rem', padding: '0.45rem 0.75rem' }}
                                                            />
                                                            <button
                                                                className="btn btn-secondary builder-add-btn"
                                                                onClick={() => addSubtopic(section.id, topic.id)}
                                                                title="Add a subtopic"
                                                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                                                            >
                                                                <i className="fas fa-plus"></i> Sub
                                                            </button>
                                                            <button
                                                                className="phase-delete"
                                                                onClick={() => removeTopic(section.id, topic.id)}
                                                                title="Remove topic"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>

                                                        {/* Subtopics */}
                                                        {(topic.children || []).length > 0 && (
                                                            <div className="builder-children builder-subtopics">
                                                                {topic.children.map((subtopic, sti) => (
                                                                    <div key={subtopic.id} className="builder-row builder-subtopic-row">
                                                                        <i className="fas fa-bookmark builder-icon" style={{ color: 'var(--secondary)', fontSize: '0.75rem' }}></i>
                                                                        <input
                                                                            className="edit-form-input builder-input"
                                                                            placeholder={`Subtopic ${sti + 1}...`}
                                                                            value={subtopic.title}
                                                                            onChange={e => updateSubtopic(section.id, topic.id, subtopic.id, e.target.value)}
                                                                            style={{ fontSize: '0.8rem', padding: '0.375rem 0.625rem' }}
                                                                        />
                                                                        <button
                                                                            className="phase-delete"
                                                                            onClick={() => removeSubtopic(section.id, topic.id, subtopic.id)}
                                                                            title="Remove subtopic"
                                                                        >
                                                                            <i className="fas fa-trash"></i>
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tip */}
                    <div className="build-phase-tip">
                        <i className="fas fa-lightbulb" style={{ color: 'var(--accent)', marginRight: '0.375rem' }}></i>
                        <span>Tip: Add, rename, or remove sections, topics, and subtopics freely. Empty fields are automatically skipped when saving.</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        <i className="fas fa-times"></i> Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
                        <i className="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

const UploadModal = ({ isOpen, onClose, onUpload, activeRoadmapName }) => {
    const [dragOver, setDragOver] = React.useState(false);
    const fileInputRef = React.useRef(null);

    if (!isOpen) return null;

    const handleFile = (file) => {
        if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    onUpload(json);
                    onClose();
                } catch (error) {
                    alert('Invalid JSON file. Please check the format.');
                }
            };
            reader.readAsText(file);
        } else {
            alert('Please upload a valid JSON file (.json extension).');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);
    const handleFileSelect = (e) => handleFile(e.target.files[0]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Upload Learning Path</h3>
                    <button className="modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    {activeRoadmapName && (
                        <div style={{ marginBottom: '1rem', padding: '0.625rem 1rem', background: 'rgba(99,102,241,0.1)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <i className="fas fa-map" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                            Adding to: <strong style={{ color: 'var(--primary)' }}>{activeRoadmapName}</strong>
                        </div>
                    )}
                    <div
                        className={`file-upload-area ${dragOver ? 'dragover' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="upload-icon">
                            <i className="fas fa-cloud-upload-alt"></i>
                        </div>
                        <div className="upload-text">Drop your JSON file here</div>
                        <div className="upload-hint">or click to browse</div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ImportModal = ({ isOpen, onClose, onImport }) => {
    const [dragOver, setDragOver] = React.useState(false);
    const [importMode, setImportMode] = React.useState('append');
    const [selectedFile, setSelectedFile] = React.useState(null);
    const [fileData, setFileData] = React.useState(null);
    const fileInputRef = React.useRef(null);

    if (!isOpen) return null;

    const handleFile = (file) => {
        if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    setFileData(json);
                    setSelectedFile(file.name);
                } catch (error) {
                    alert('Invalid JSON file. Please check the format.');
                }
            };
            reader.readAsText(file);
        } else {
            alert('Please upload a valid JSON file (.json extension).');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);
    const handleFileSelect = (e) => handleFile(e.target.files[0]);

    const handleImportConfirm = () => {
        if (fileData) {
            onImport(fileData, importMode);
            setSelectedFile(null);
            setFileData(null);
            setImportMode('append');
            onClose();
        }
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setFileData(null);
        setImportMode('append');
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Import Progress</h3>
                    <button className="modal-close" onClick={handleCancel}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    {!selectedFile ? (
                        <>
                            <div
                                className={`file-upload-area ${dragOver ? 'dragover' : ''}`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="upload-icon">
                                    <i className="fas fa-file-import"></i>
                                </div>
                                <div className="upload-text">Drop your exported JSON file here</div>
                                <div className="upload-hint">or click to browse</div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    style={{ display: 'none' }}
                                    onChange={handleFileSelect}
                                />
                            </div>
                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                <i className="fas fa-info-circle" style={{ marginRight: '0.5rem' }}></i>
                                Only exported JSON files from this app are accepted
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <i className="fas fa-file-alt" style={{ color: 'var(--primary)' }}></i>
                                    <span style={{ fontWeight: '500' }}>{selectedFile}</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                                    Import Mode:
                                </label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="importMode"
                                            value="append"
                                            checked={importMode === 'append'}
                                            onChange={(e) => setImportMode(e.target.value)}
                                        />
                                        <span>Append to existing</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="importMode"
                                            value="overwrite"
                                            checked={importMode === 'overwrite'}
                                            onChange={(e) => setImportMode(e.target.value)}
                                        />
                                        <span>Overwrite existing</span>
                                    </label>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {selectedFile && (
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleImportConfirm}>
                            <i className="fas fa-file-import"></i> Import
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Confirm Delete</h3>
                    <button className="modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <div className="delete-confirm">
                        <div className="delete-icon"><i className="fas fa-exclamation-triangle"></i></div>
                        <h4 className="delete-title">Delete All Progress?</h4>
                        <p className="delete-message">
                            This will permanently delete all your roadmaps and learning progress.
                            This action cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-danger" onClick={onConfirm}>
                        <i className="fas fa-trash"></i> Delete All
                    </button>
                </div>
            </div>
        </div>
    );
};

const SmallConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, confirmIcon }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <p style={{ color: 'var(--text-secondary)', margin: '0' }}>{message}</p>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={onConfirm}>
                        {confirmIcon && <i className={`fas ${confirmIcon}`}></i>} {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Toast = ({ message, type, onClose }) => {
    React.useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast toast-${type}`}>
            <div className="toast-content">
                <div className="toast-message">{message}</div>
            </div>
            <button className="toast-close" onClick={onClose}>
                <i className="fas fa-times"></i>
            </button>
        </div>
    );
};

const GlobalSearchResults = ({ searchTerm, phases, onNodeClick, onClose, onSearchChange }) => {
    const searchInputRef = React.useRef(null);

    React.useEffect(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
    }, []);

    if (!phases || phases.length === 0) return null;

    const term = searchTerm.toLowerCase();

    const getAllMatchingNodes = () => {
        const results = [];
        phases.forEach((phase, phaseIndex) => {
            const getAllNodes = (node) => {
                let nodes = [node];
                node.children.forEach(child => { nodes = nodes.concat(getAllNodes(child)); });
                return nodes;
            };
            const allNodes = getAllNodes(phase.root);
            const matchingNodes = allNodes.filter(node =>
                node.title.toLowerCase().includes(term) && node.id !== phase.root.id
            );
            matchingNodes.forEach(node => {
                results.push({ node, phaseIndex, phaseName: phase.data.phase, phaseTitle: phase.data.title });
            });
        });
        return results;
    };

    const matchingResults = searchTerm ? getAllMatchingNodes() : [];

    const getNodePath = (node, rootId) => {
        const path = [];
        let current = node.parent;
        while (current && current.id !== rootId) {
            path.unshift(current.title);
            current = current.parent;
        }
        return path;
    };

    return (
        <div className="global-search-overlay" onClick={onClose}>
            <div className="global-search-container" onClick={(e) => e.stopPropagation()}>
                <div className="global-search-header">
                    <div className="global-search-input-wrapper">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="global-search-input"
                            placeholder="Search across all phases..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            autoFocus
                        />
                        <button className="global-search-close" onClick={onClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div className="global-search-results">
                    {!searchTerm ? (
                        <div className="search-no-results">
                            <i className="fas fa-search"></i>
                            <p>Start typing to search across all phases...</p>
                        </div>
                    ) : matchingResults.length === 0 ? (
                        <div className="search-no-results">
                            <i className="fas fa-search"></i>
                            <p>No results found for "{searchTerm}"</p>
                        </div>
                    ) : (
                        <>
                            <div className="search-results-count">
                                {matchingResults.length} result{matchingResults.length !== 1 ? 's' : ''} found across {new Set(matchingResults.map(r => r.phaseIndex)).size} phase{new Set(matchingResults.map(r => r.phaseIndex)).size !== 1 ? 's' : ''}
                            </div>
                            <div className="global-search-results-list">
                                {matchingResults.map((result, idx) => {
                                    const { node, phaseIndex, phaseName } = result;
                                    const path = getNodePath(node, phases[phaseIndex].root.id);
                                    const progress = node.calculateProgress();
                                    return (
                                        <div
                                            key={`${phaseIndex}-${node.id}-${idx}`}
                                            className="global-search-result-item"
                                            onClick={() => { onNodeClick(node, phaseIndex); onClose(); }}
                                        >
                                            <div className="search-result-phase-badge">
                                                <i className="fas fa-layer-group"></i>
                                                {phaseName}
                                            </div>
                                            <div className="search-result-content">
                                                <div className="search-result-title">
                                                    <i className={`fas fa-${
                                                        node.type === 'phase' ? 'layer-group' :
                                                        node.type === 'section' ? 'folder' :
                                                        node.type === 'topic' ? 'book' :
                                                        'bookmark'
                                                    }`}></i>
                                                    {node.title}
                                                </div>
                                                {path.length > 0 && (
                                                    <div className="search-result-path">{path.join(' > ')}</div>
                                                )}
                                                <div className="search-result-meta">
                                                    <span className="search-result-badge">{node.type}</span>
                                                    {node.children.length > 0 && (
                                                        <>
                                                            <span className="search-result-badge">{node.children.length} items</span>
                                                            <span className="search-result-badge">{progress.toFixed(0)}% complete</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="search-result-action">
                                                <i className="fas fa-arrow-right"></i>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============= MAIN APP =============
const App = () => {
    // ---- Core State ----
    const [roadmaps, setRoadmaps] = React.useState([]);
    const [activeRoadmapId, setActiveRoadmapId] = React.useState(null);
    const [activePhaseIndex, setActivePhaseIndex] = React.useState(null);

    // ---- UI State ----
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [showImportModal, setShowImportModal] = React.useState(false);
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [showCreateRoadmapModal, setShowCreateRoadmapModal] = React.useState(false);
    const [showBuildPhaseModal, setShowBuildPhaseModal] = React.useState(false);
    const [showDeleteRoadmapModal, setShowDeleteRoadmapModal] = React.useState(false);
    const [showRenameRoadmapModal, setShowRenameRoadmapModal] = React.useState(false);
    const [roadmapToDelete, setRoadmapToDelete] = React.useState(null);

    const [searchTerm, setSearchTerm] = React.useState('');
    const [showGlobalSearch, setShowGlobalSearch] = React.useState(false);
    const [toasts, setToasts] = React.useState([]);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState({
        roadmaps: false,
        progress: false,
        phases: false
    });
    const [headerCollapsed, setHeaderCollapsed] = React.useState(false);
    const [controlsCollapsed, setControlsCollapsed] = React.useState(false);
    const [isTreeFullscreen, setIsTreeFullscreen] = React.useState(false);
    const [showScrollTop, setShowScrollTop] = React.useState(false);
    const [showInfoModal, setShowInfoModal] = React.useState(false);
    const [selectedInfoNode, setSelectedInfoNode] = React.useState(null);
    const [showEditModal, setShowEditModal] = React.useState(false);
    const [selectedEditNode, setSelectedEditNode] = React.useState(null);
    const [showCompleteAllModal, setShowCompleteAllModal] = React.useState(false);
    const [showResetAllModal, setShowResetAllModal] = React.useState(false);
    const [showDeletePhaseModal, setShowDeletePhaseModal] = React.useState(false);
    const [phaseToDelete, setPhaseToDelete] = React.useState(null);
    const [showRenamePhaseModal, setShowRenamePhaseModal] = React.useState(false);
    const [phaseToRenameIndex, setPhaseToRenameIndex] = React.useState(null);
    const [showEditPhaseModal, setShowEditPhaseModal] = React.useState(false);
    const [phaseToEditIndex, setPhaseToEditIndex] = React.useState(null);

    // ---- Derived State ----
    const activeRoadmap = roadmaps.find(r => r.id === activeRoadmapId) || null;
    const phases = activeRoadmap ? activeRoadmap.phases : [];

    // ---- Load from storage ----
    React.useEffect(() => {
        const savedData = StorageService.loadRoadmaps();
        if (savedData && savedData.length > 0) {
            const loadedRoadmaps = savedData.map(rmData => ({
                id: rmData.id || generateRoadmapId(),
                name: rmData.name || 'My Roadmap',
                phases: (rmData.phases || []).map(phaseData => {
                    const root = buildTree(phaseData.data);
                    if (phaseData.completionMap) {
                        StorageService.applyCompletionMap(root, phaseData.completionMap);
                    }
                    return { data: phaseData.data, root };
                })
            }));
            setRoadmaps(loadedRoadmaps);
            setActiveRoadmapId(loadedRoadmaps[0].id);
            if (loadedRoadmaps[0].phases.length > 0) setActivePhaseIndex(0);
        }
    }, []);

    // ---- Auto-save ----
    React.useEffect(() => {
        if (roadmaps.length > 0) StorageService.saveRoadmaps(roadmaps);
    }, [roadmaps]);

    // ---- ESC key exits fullscreen ----
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isTreeFullscreen) setIsTreeFullscreen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isTreeFullscreen]);

    // ---- Scroll handler ----
    React.useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const treeViewport = document.querySelector('.tree-viewport');
            const treeScroll = treeViewport ? treeViewport.scrollTop : 0;
            setShowScrollTop(scrollY > 300 || treeScroll > 300);
        };
        window.addEventListener('scroll', handleScroll);
        const treeViewport = document.querySelector('.tree-viewport');
        if (treeViewport) treeViewport.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (treeViewport) treeViewport.removeEventListener('scroll', handleScroll);
        };
    }, [phases, activePhaseIndex]);

    // ============= TOASTS =============
    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };
    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    // ============= ROADMAP HANDLERS =============
    const handleCreateRoadmap = (name) => {
        const newRoadmap = { id: generateRoadmapId(), name, phases: [] };
        setRoadmaps(prev => [...prev, newRoadmap]);
        setActiveRoadmapId(newRoadmap.id);
        setActivePhaseIndex(null);
        addToast(`Roadmap "${name}" created`, 'success');
    };

    const handleSelectRoadmap = (id) => {
        setActiveRoadmapId(id);
        const rm = roadmaps.find(r => r.id === id);
        setActivePhaseIndex(rm && rm.phases.length > 0 ? 0 : null);
    };

    const handleDeleteRoadmap = (id) => {
        setRoadmapToDelete(id);
        setShowDeleteRoadmapModal(true);
    };

    const confirmDeleteRoadmap = () => {
        if (roadmapToDelete) {
            const deletedRoadmap = roadmaps.find(r => r.id === roadmapToDelete);
            const newRoadmaps = roadmaps.filter(r => r.id !== roadmapToDelete);
            setRoadmaps(newRoadmaps);
            if (activeRoadmapId === roadmapToDelete) {
                const newActive = newRoadmaps.length > 0 ? newRoadmaps[0].id : null;
                setActiveRoadmapId(newActive);
                const newActiveRm = newRoadmaps.find(r => r.id === newActive);
                setActivePhaseIndex(newActiveRm && newActiveRm.phases.length > 0 ? 0 : null);
            }
            if (newRoadmaps.length === 0) StorageService.clearAllProgress();
            addToast(`Roadmap "${deletedRoadmap?.name || ''}" deleted`, 'success');
        }
        setShowDeleteRoadmapModal(false);
        setRoadmapToDelete(null);
    };

    const handleRenameRoadmap = (newName) => {
        setRoadmaps(prev => prev.map(r =>
            r.id === activeRoadmapId ? { ...r, name: newName } : r
        ));
        addToast('Roadmap renamed', 'success');
    };

    // ============= UPLOAD / IMPORT =============
    const handleUpload = (data) => {
        try {
            let newPhases = [];
            if (Array.isArray(data)) {
                newPhases = data.map(phaseData => ({ data: phaseData, root: buildTree(phaseData) }));
            } else {
                newPhases = [{ data, root: buildTree(data) }];
            }

            if (!activeRoadmapId || roadmaps.length === 0) {
                const newRoadmap = { id: generateRoadmapId(), name: 'My Roadmap', phases: newPhases };
                setRoadmaps(prev => [...prev, newRoadmap]);
                setActiveRoadmapId(newRoadmap.id);
                setActivePhaseIndex(0);
            } else {
                const currentCount = activeRoadmap ? activeRoadmap.phases.length : 0;
                setRoadmaps(prev => prev.map(r =>
                    r.id === activeRoadmapId ? { ...r, phases: [...r.phases, ...newPhases] } : r
                ));
                setActivePhaseIndex(currentCount);
            }
            addToast(`Successfully loaded ${newPhases.length} phase(s)`, 'success');
        } catch (error) {
            console.error('Error processing upload:', error);
            addToast('Error loading file. Please check the format.', 'error');
        }
    };

    // ============= BUILD PHASE HANDLER (NEW) =============
    const handleBuildPhase = (phaseData) => {
        try {
            const root = buildTree(phaseData);
            const newPhase = { data: phaseData, root };

            if (!activeRoadmapId || roadmaps.length === 0) {
                const newRoadmap = { id: generateRoadmapId(), name: 'My Roadmap', phases: [newPhase] };
                setRoadmaps(prev => [...prev, newRoadmap]);
                setActiveRoadmapId(newRoadmap.id);
                setActivePhaseIndex(0);
            } else {
                const currentCount = activeRoadmap ? activeRoadmap.phases.length : 0;
                setRoadmaps(prev => prev.map(r =>
                    r.id === activeRoadmapId ? { ...r, phases: [...r.phases, newPhase] } : r
                ));
                setActivePhaseIndex(currentCount);
            }
            addToast(`Phase "${phaseData.phase}" created successfully`, 'success');
        } catch (error) {
            console.error('Error building phase:', error);
            addToast('Error creating phase. Please try again.', 'error');
        }
    };

    const handleImport = (data, mode) => {
        try {
            const validated = StorageService.validateImport(data);

            if (validated.type === 'roadmaps') {
                const importedRoadmaps = validated.data.map(rm => ({
                    id: rm.id || generateRoadmapId(),
                    name: rm.name || 'Imported Roadmap',
                    phases: (rm.phases || []).map(phaseData => {
                        const root = buildTree(phaseData.data);
                        if (phaseData.completionMap) StorageService.applyCompletionMap(root, phaseData.completionMap);
                        return { data: phaseData.data, root };
                    })
                }));
                if (mode === 'overwrite') {
                    setRoadmaps(importedRoadmaps);
                    setActiveRoadmapId(importedRoadmaps[0]?.id || null);
                    setActivePhaseIndex(importedRoadmaps[0]?.phases.length > 0 ? 0 : null);
                    addToast('Progress overwritten successfully', 'success');
                } else {
                    setRoadmaps(prev => [...prev, ...importedRoadmaps]);
                    if (!activeRoadmapId && importedRoadmaps.length > 0) {
                        setActiveRoadmapId(importedRoadmaps[0].id);
                        setActivePhaseIndex(importedRoadmaps[0].phases.length > 0 ? 0 : null);
                    }
                    addToast(`${importedRoadmaps.length} roadmap(s) imported`, 'success');
                }
            } else {
                const importedPhases = validated.data.map(phaseData => {
                    const root = buildTree(phaseData.data);
                    if (phaseData.completionMap) StorageService.applyCompletionMap(root, phaseData.completionMap);
                    return { data: phaseData.data, root };
                });
                if (mode === 'overwrite') {
                    if (activeRoadmapId) {
                        setRoadmaps(prev => prev.map(r =>
                            r.id === activeRoadmapId ? { ...r, phases: importedPhases } : r
                        ));
                        setActivePhaseIndex(importedPhases.length > 0 ? 0 : null);
                    } else {
                        const newRm = { id: generateRoadmapId(), name: 'Imported Roadmap', phases: importedPhases };
                        setRoadmaps([newRm]);
                        setActiveRoadmapId(newRm.id);
                        setActivePhaseIndex(0);
                    }
                    addToast('Phases overwritten successfully', 'success');
                } else {
                    if (!activeRoadmapId) {
                        const newRm = { id: generateRoadmapId(), name: 'Imported Roadmap', phases: importedPhases };
                        setRoadmaps(prev => [...prev, newRm]);
                        setActiveRoadmapId(newRm.id);
                        setActivePhaseIndex(0);
                    } else {
                        const currentCount = activeRoadmap ? activeRoadmap.phases.length : 0;
                        setRoadmaps(prev => prev.map(r =>
                            r.id === activeRoadmapId ? { ...r, phases: [...r.phases, ...importedPhases] } : r
                        ));
                        setActivePhaseIndex(currentCount);
                    }
                    addToast(`${importedPhases.length} phase(s) imported`, 'success');
                }
            }
        } catch (error) {
            console.error('Import error:', error);
            addToast(error.message || 'Error importing progress', 'error');
        }
    };

    const handleDeleteAllProgress = () => {
        StorageService.clearAllProgress();
        setRoadmaps([]);
        setActiveRoadmapId(null);
        setActivePhaseIndex(null);
        setShowDeleteModal(false);
        addToast('All progress deleted', 'success');
    };

    const handleExportProgress = () => {
        try {
            const exportData = StorageService.exportProgress(roadmaps);
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `learning-progress-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            addToast('Progress exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting progress:', error);
            addToast('Error exporting progress', 'error');
        }
    };

    // ============= TREE NODE HANDLERS =============
    const setNodeAndChildren = (node, value) => {
        node.completed = value;
        node.children.forEach(child => setNodeAndChildren(child, value));
    };

    const updateParents = (node) => {
        if (!node.parent) return;
        const parent = node.parent;
        const allComplete = parent.children.every(c => c.completed);
        const anyComplete = parent.children.some(c => c.completed);
        if (allComplete) parent.completed = true;
        else if (!anyComplete) parent.completed = false;
        else parent.completed = false;
        updateParents(parent);
    };

    const handleCheckNode = (node) => {
        setNodeAndChildren(node, !node.completed);
        updateParents(node);
        setRoadmaps([...roadmaps]);
    };

    const handleToggleNode = (node, expanded) => {
        node.expanded = expanded;
        setRoadmaps([...roadmaps]);
    };

    const handleCopyNode = (type, message) => addToast(message, type);

    const handleShowInfo = (node) => {
        setSelectedInfoNode(node);
        setShowInfoModal(true);
    };

    const handleEdit = (node) => {
        setSelectedEditNode(node);
        setShowEditModal(true);
    };

    const handleSaveEdit = (node, newTitle) => {
        node.title = newTitle;
        node.data.title = newTitle;
        setRoadmaps([...roadmaps]);
        addToast('Node updated successfully', 'success');
    };

    // ============= PHASE HANDLERS =============
    const handleDeletePhase = (index) => {
        setPhaseToDelete(index);
        setShowDeletePhaseModal(true);
    };

    const confirmDeletePhase = () => {
        if (phaseToDelete !== null) {
            setRoadmaps(prev => prev.map(r =>
                r.id === activeRoadmapId
                    ? { ...r, phases: r.phases.filter((_, i) => i !== phaseToDelete) }
                    : r
            ));
            const newCount = phases.length - 1;
            if (activePhaseIndex === phaseToDelete) {
                setActivePhaseIndex(newCount > 0 ? 0 : null);
            } else if (activePhaseIndex > phaseToDelete) {
                setActivePhaseIndex(activePhaseIndex - 1);
            }
            addToast('Phase deleted successfully', 'success');
        }
        setShowDeletePhaseModal(false);
        setPhaseToDelete(null);
    };

    const handleRenamePhaseClick = (index) => {
        setPhaseToRenameIndex(index);
        setShowRenamePhaseModal(true);
    };

    const confirmRenamePhase = (newName) => {
        if (phaseToRenameIndex !== null && activeRoadmapId) {
            setRoadmaps(prev => prev.map(r => {
                if (r.id !== activeRoadmapId) return r;
                const updatedPhases = r.phases.map((p, i) => {
                    if (i !== phaseToRenameIndex) return p;
                    p.data.phase = newName;
                    p.root.data.phase = newName;
                    return p;
                });
                return { ...r, phases: updatedPhases };
            }));
            addToast('Phase renamed successfully', 'success');
        }
        setShowRenamePhaseModal(false);
        setPhaseToRenameIndex(null);
    };

    // ============= EDIT PHASE STRUCTURE HANDLERS =============
    const handleEditPhaseClick = (index) => {
        setPhaseToEditIndex(index);
        setShowEditPhaseModal(true);
    };

    const handleSaveEditedPhase = (phaseData, index) => {
        try {
            // Build a fresh tree from the updated data
            const newRoot = buildTree(phaseData);

            // Preserve completion state: serialize old completionMap keyed by node id,
            // then apply it to the new tree.  Node ids are positional (e.g. "1.1", "1.1.2"),
            // so items that stay in the same structural position keep their progress.
            const oldPhase = phases[index];
            if (oldPhase) {
                const oldMap = StorageService.serializeCompletionMap(oldPhase.root);
                StorageService.applyCompletionMap(newRoot, oldMap);
            }

            setRoadmaps(prev => prev.map(r => {
                if (r.id !== activeRoadmapId) return r;
                const updatedPhases = r.phases.map((p, i) => {
                    if (i !== index) return p;
                    return { data: phaseData, root: newRoot };
                });
                return { ...r, phases: updatedPhases };
            }));

            addToast(`Phase "${phaseData.phase}" updated successfully`, 'success');
        } catch (error) {
            console.error('Error saving edited phase:', error);
            addToast('Error saving phase. Please try again.', 'error');
        }
    };

    // ============= EXPAND / COLLAPSE / MARK =============
    const expandAll = () => {
        if (!phases[activePhaseIndex]) return;
        const setExpanded = (node) => { node.expanded = true; node.children.forEach(setExpanded); };
        setExpanded(phases[activePhaseIndex].root);
        setRoadmaps([...roadmaps]);
    };

    const collapseAll = () => {
        if (!phases[activePhaseIndex]) return;
        const setCollapsed = (node) => { node.expanded = false; node.children.forEach(setCollapsed); };
        setCollapsed(phases[activePhaseIndex].root);
        setRoadmaps([...roadmaps]);
    };

    const markAllComplete = () => setShowCompleteAllModal(true);

    const confirmMarkAllComplete = () => {
        if (phases[activePhaseIndex]) {
            setNodeAndChildren(phases[activePhaseIndex].root, true);
            setRoadmaps([...roadmaps]);
            addToast('All items marked complete', 'success');
        }
        setShowCompleteAllModal(false);
    };

    const markAllIncomplete = () => setShowResetAllModal(true);

    const confirmMarkAllIncomplete = () => {
        if (phases[activePhaseIndex]) {
            setNodeAndChildren(phases[activePhaseIndex].root, false);
            setRoadmaps([...roadmaps]);
            addToast('All items reset', 'success');
        }
        setShowResetAllModal(false);
    };

    const toggleSidebarSection = (section) => {
        setSidebarCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // ============= GLOBAL SEARCH =============
    const handleGlobalSearchNodeClick = (node, phaseIndex) => {
        setActivePhaseIndex(phaseIndex);
        let current = node.parent;
        while (current) { current.expanded = true; current = current.parent; }
        node.highlighted = true;
        setRoadmaps([...roadmaps]);
        setTimeout(() => {
            const element = document.querySelector(`[data-node-id="${node.id}"]`);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => { node.highlighted = false; setRoadmaps([...roadmaps]); }, 2000);
    };

    const handleOpenGlobalSearch = () => { setShowGlobalSearch(true); setSearchTerm(''); };
    const handleCloseGlobalSearch = () => { setShowGlobalSearch(false); setSearchTerm(''); };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const treeViewport = document.querySelector('.tree-viewport');
        if (treeViewport) treeViewport.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ============= COMPUTED VALUES =============
    const activePhase = activePhaseIndex !== null ? phases[activePhaseIndex] : null;

    const getAllNodes = (node) => {
        let nodes = [node];
        node.children.forEach(child => { nodes = nodes.concat(getAllNodes(child)); });
        return nodes;
    };

    const calculateOverallProgress = () => {
        if (!activeRoadmap || phases.length === 0) return 0;
        const leafNodes = [];
        phases.forEach(phase => {
            getAllNodes(phase.root).forEach(n => { if (n.isLeaf()) leafNodes.push(n); });
        });
        if (leafNodes.length === 0) return 0;
        return (leafNodes.filter(n => n.completed).length / leafNodes.length) * 100;
    };

    const calculateStats = () => {
        if (!activeRoadmap || phases.length === 0) return { total: 0, completed: 0 };
        const leafNodes = [];
        phases.forEach(phase => {
            getAllNodes(phase.root).forEach(n => { if (n.isLeaf()) leafNodes.push(n); });
        });
        return { total: leafNodes.length, completed: leafNodes.filter(n => n.completed).length };
    };

    const progress = calculateOverallProgress();
    const stats = calculateStats();
    const totalNodes = stats.total;
    const completedNodes = stats.completed;
    const filteredChildren = activePhase ? activePhase.root.children : [];

    // ============= RENDER =============
    return (
        <div className="app-container">
            {/* ---- HEADER ---- */}
            <header className={`app-header ${headerCollapsed ? 'collapsed' : ''}`}>
                <div className="header-wrapper">
                    {headerCollapsed && (
                        <div className="compact-header">
                            <div className="compact-logo">
                                <i className="fas fa-graduation-cap"></i>
                                <span>LearnPath</span>
                            </div>
                            <button className="header-toggle-btn" onClick={() => setHeaderCollapsed(false)}>
                                <span>Show Menu</span>
                                <i className="fas fa-chevron-down header-toggle-icon"></i>
                            </button>
                        </div>
                    )}
                    {!headerCollapsed && (
                        <>
                            <div className="header-content">
                                <div className="logo">
                                    <div className="logo-icon">
                                        <i className="fas fa-graduation-cap"></i>
                                    </div>
                                    <span className="logo-text">LearnPath</span>
                                </div>

                                {/* Organized Action Buttons */}
                                <div className="action-buttons">
                                    {/* Group 1: Create */}
                                    <div className="action-btn-group">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setShowCreateRoadmapModal(true)}
                                            title="Create a new roadmap container"
                                        >
                                            <i className="fas fa-map"></i> New Roadmap
                                        </button>
                                    </div>

                                    <div className="action-btn-divider"></div>

                                    {/* Group 2: Upload / Import */}
                                    <div className="action-btn-group">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setShowUploadModal(true)}
                                            title="Upload a JSON roadmap file"
                                        >
                                            <i className="fas fa-upload"></i> Upload JSON
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setShowImportModal(true)}
                                            title="Import progress from exported file"
                                        >
                                            <i className="fas fa-file-import"></i> Import
                                        </button>
                                    </div>

                                    {roadmaps.length > 0 && (
                                        <>
                                            <div className="action-btn-divider"></div>

                                            {/* Group 3: Manage */}
                                            <div className="action-btn-group">
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={handleExportProgress}
                                                    title="Export your progress"
                                                >
                                                    <i className="fas fa-download"></i> Export
                                                </button>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => setShowDeleteModal(true)}
                                                    title="Delete all progress"
                                                >
                                                    <i className="fas fa-trash"></i> Delete All
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="header-toggle">
                                <button className="header-toggle-btn" onClick={() => setHeaderCollapsed(true)}>
                                    <span>Hide Menu</span>
                                    <i className="fas fa-chevron-up header-toggle-icon"></i>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* ---- MAIN CONTENT ---- */}
            <main className="app-main">
                {roadmaps.length === 0 ? (
                    /* ---- EMPTY STATE (no roadmaps at all) ---- */
                    <div className="empty-state">
                        <div className="empty-icon">
                            <i className="fas fa-road"></i>
                        </div>
                        <h2 className="empty-title">No Learning Paths Yet</h2>
                        <p className="empty-description">
                            Create a roadmap to organise your learning journey. Build phases manually or upload JSON files to track your progress.
                        </p>
                        <div className="empty-action-groups">
                            {/* Create group */}
                            <div className="empty-action-group">
                                <div className="empty-action-group-label">Start Fresh</div>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary" onClick={() => setShowCreateRoadmapModal(true)}>
                                        <i className="fas fa-map"></i> New Roadmap
                                    </button>
                                </div>
                            </div>
                            {/* Import group */}
                            <div className="empty-action-group">
                                <div className="empty-action-group-label">Import Data</div>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
                                        <i className="fas fa-upload"></i> Upload JSON
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
                                        <i className="fas fa-file-import"></i> Import Progress
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ---- DASHBOARD ---- */
                    <div className="dashboard">
                        {/* ---- SIDEBAR ---- */}
                        <div className="sidebar">

                            {/* Roadmaps Card */}
                            <div className={`sidebar-card ${sidebarCollapsed.roadmaps ? 'collapsed' : ''}`}>
                                <div className="sidebar-header">
                                    <h3 className="sidebar-title">
                                        <i className="fas fa-map"></i> Roadmaps
                                        <span style={{
                                            marginLeft: '0.375rem',
                                            fontSize: '0.75rem',
                                            background: 'var(--primary)',
                                            color: 'white',
                                            borderRadius: '999px',
                                            padding: '0.1rem 0.4rem',
                                            fontWeight: '600'
                                        }}>
                                            {roadmaps.length}
                                        </span>
                                    </h3>
                                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                        <button
                                            className="node-action-btn"
                                            onClick={() => setShowCreateRoadmapModal(true)}
                                            title="Create new roadmap"
                                            style={{ borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}
                                        >
                                            <i className="fas fa-plus"></i>
                                        </button>
                                        <button
                                            className="toggle-btn"
                                            onClick={() => toggleSidebarSection('roadmaps')}
                                        >
                                            <i className={`fas fa-chevron-${sidebarCollapsed.roadmaps ? 'down' : 'up'}`}></i>
                                        </button>
                                    </div>
                                </div>
                                <div className="sidebar-content">
                                    <div className="phase-list">
                                        {roadmaps.map((roadmap) => (
                                            <RoadmapListItem
                                                key={roadmap.id}
                                                roadmap={roadmap}
                                                isActive={roadmap.id === activeRoadmapId}
                                                onClick={handleSelectRoadmap}
                                                onDelete={handleDeleteRoadmap}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Progress Card */}
                            <div className={`sidebar-card ${sidebarCollapsed.progress ? 'collapsed' : ''}`}>
                                <div className="sidebar-header">
                                    <h3 className="sidebar-title">
                                        <i className="fas fa-chart-pie"></i>
                                        {activeRoadmap ? (
                                            <span style={{ marginLeft: '0.25rem' }}>{activeRoadmap.name}</span>
                                        ) : ' Progress'}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                        {activeRoadmap && (
                                            <button
                                                className="node-action-btn"
                                                onClick={() => setShowRenameRoadmapModal(true)}
                                                title="Rename roadmap"
                                                style={{ borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}
                                            >
                                                <i className="fas fa-pen"></i>
                                            </button>
                                        )}
                                        <button
                                            className="toggle-btn"
                                            onClick={() => toggleSidebarSection('progress')}
                                        >
                                            <i className={`fas fa-chevron-${sidebarCollapsed.progress ? 'down' : 'up'}`}></i>
                                        </button>
                                    </div>
                                </div>
                                <div className="sidebar-content">
                                    <ProgressCircle progress={progress} />
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <div className="stat-value">{completedNodes}</div>
                                            <div className="stat-label">Completed</div>
                                        </div>
                                        <div className="stat-item">
                                            <div className="stat-value">{totalNodes}</div>
                                            <div className="stat-label">Total</div>
                                        </div>
                                        <div className="stat-item">
                                            <div className="stat-value">{phases.length}</div>
                                            <div className="stat-label">Phases</div>
                                        </div>
                                        <div className="stat-item">
                                            <div className="stat-value">{roadmaps.length}</div>
                                            <div className="stat-label">Roadmaps</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Phases Card */}
                            <div className={`sidebar-card ${sidebarCollapsed.phases ? 'collapsed' : ''}`}>
                                <div className="sidebar-header">
                                    <h3 className="sidebar-title">
                                        <i className="fas fa-list"></i> Phases
                                    </h3>
                                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                        {activeRoadmap && (
                                            <button
                                                className="node-action-btn"
                                                onClick={() => setShowBuildPhaseModal(true)}
                                                title="Build a new phase manually"
                                                style={{ borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}
                                            >
                                                <i className="fas fa-sitemap"></i>
                                            </button>
                                        )}
                                        {activeRoadmap && (
                                            <button
                                                className="node-action-btn"
                                                onClick={() => setShowUploadModal(true)}
                                                title="Upload JSON phase"
                                                style={{ borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}
                                            >
                                                <i className="fas fa-upload"></i>
                                            </button>
                                        )}
                                        <button
                                            className="toggle-btn"
                                            onClick={() => toggleSidebarSection('phases')}
                                        >
                                            <i className={`fas fa-chevron-${sidebarCollapsed.phases ? 'down' : 'up'}`}></i>
                                        </button>
                                    </div>
                                </div>
                                <div className="sidebar-content">
                                    {phases.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                            <i className="fas fa-layer-group" style={{ display: 'block', fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.4 }}></i>
                                            No phases yet.
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                                    onClick={() => setShowBuildPhaseModal(true)}
                                                >
                                                    <i className="fas fa-sitemap"></i> Build
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                                    onClick={() => setShowUploadModal(true)}
                                                >
                                                    <i className="fas fa-upload"></i> Upload
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="phase-list">
                                            {phases.map((phase, idx) => (
                                                <PhaseListItem
                                                    key={idx}
                                                    phase={phase}
                                                    index={idx}
                                                    isActive={idx === activePhaseIndex}
                                                    onClick={setActivePhaseIndex}
                                                    onDelete={handleDeletePhase}
                                                    onRename={handleRenamePhaseClick}
                                                    onEdit={handleEditPhaseClick}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ---- MAIN CONTENT AREA ---- */}
                        <div className={`main-content${isTreeFullscreen ? ' tree-fullscreen' : ''}`}>
                            {phases.length === 0 ? (
                                /* Empty state when roadmap exists but has no phases */
                                <div className="empty-state" style={{ minHeight: '40vh' }}>
                                    <div className="empty-icon" style={{ fontSize: '3rem' }}>
                                        <i className="fas fa-layer-group"></i>
                                    </div>
                                    <h3 className="empty-title" style={{ fontSize: '1.5rem' }}>
                                        No Phases in "{activeRoadmap?.name}"
                                    </h3>
                                    <p className="empty-description">
                                        Build your first phase manually by adding sections and topics, or upload a JSON file to get started.
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <button className="btn btn-primary" onClick={() => setShowBuildPhaseModal(true)}>
                                            <i className="fas fa-sitemap"></i> Build Phase
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
                                            <i className="fas fa-upload"></i> Upload JSON
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={`content-header ${controlsCollapsed ? 'collapsed' : ''}`}>
                                        <div className="content-header-main">
                                            <div className="content-title">
                                                <h2>{activePhase?.data.phase || 'No Phase Selected'}</h2>
                                                <p className="content-subtitle">{activePhase?.data.title || 'Select a phase to view'}</p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                                <button
                                                    className="toggle-btn"
                                                    onClick={() => setIsTreeFullscreen(!isTreeFullscreen)}
                                                    title={isTreeFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
                                                >
                                                    <i className={`fas fa-${isTreeFullscreen ? 'compress' : 'expand'}`}></i>
                                                </button>
                                                <button
                                                    className="toggle-btn"
                                                    onClick={() => setControlsCollapsed(!controlsCollapsed)}
                                                    title={controlsCollapsed ? "Show controls" : "Hide controls"}
                                                >
                                                    <i className={`fas fa-chevron-${controlsCollapsed ? 'down' : 'up'}`}></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="tree-container">
                                        {!controlsCollapsed && (
                                            <div className="content-header">
                                                <div className="btn-group">
                                                    <button className="btn btn-secondary" onClick={expandAll}>
                                                        <i className="fas fa-expand-alt"></i> Expand All
                                                    </button>
                                                    <button className="btn btn-secondary" onClick={collapseAll}>
                                                        <i className="fas fa-compress-alt"></i> Collapse All
                                                    </button>
                                                    <button className="btn btn-success" onClick={markAllComplete}>
                                                        <i className="fas fa-check-double"></i> Complete All
                                                    </button>
                                                    <button className="btn btn-secondary" onClick={markAllIncomplete}>
                                                        <i className="fas fa-undo"></i> Reset All
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="tree-viewport">
                                            {filteredChildren.length > 0 ? (
                                                filteredChildren.map((node) => (
                                                    <TreeNodeComponent
                                                        key={node.id}
                                                        node={node}
                                                        onToggle={handleToggleNode}
                                                        onCheck={handleCheckNode}
                                                        searchTerm=""
                                                        onCopy={handleCopyNode}
                                                        onShowInfo={handleShowInfo}
                                                        onEdit={handleEdit}
                                                    />
                                                ))
                                            ) : (
                                                <div className="empty-state">
                                                    <div className="empty-icon"><i className="fas fa-tree"></i></div>
                                                    <h3 className="empty-title">No content available</h3>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* ---- MODALS ---- */}
            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUpload={handleUpload}
                activeRoadmapName={activeRoadmap?.name}
            />

            <ImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImport}
            />

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteAllProgress}
            />

            <CreateRoadmapModal
                isOpen={showCreateRoadmapModal}
                onClose={() => setShowCreateRoadmapModal(false)}
                onCreate={handleCreateRoadmap}
            />

            <BuildPhaseModal
                isOpen={showBuildPhaseModal}
                onClose={() => setShowBuildPhaseModal(false)}
                onCreate={handleBuildPhase}
            />

            <EditPhaseModal
                isOpen={showEditPhaseModal}
                onClose={() => { setShowEditPhaseModal(false); setPhaseToEditIndex(null); }}
                onSave={handleSaveEditedPhase}
                phase={phaseToEditIndex !== null ? phases[phaseToEditIndex] : null}
                phaseIndex={phaseToEditIndex}
            />

            <RenameRoadmapModal
                isOpen={showRenameRoadmapModal}
                onClose={() => setShowRenameRoadmapModal(false)}
                onRename={handleRenameRoadmap}
                currentName={activeRoadmap?.name || ''}
            />

            <SmallConfirmModal
                isOpen={showDeleteRoadmapModal}
                onClose={() => { setShowDeleteRoadmapModal(false); setRoadmapToDelete(null); }}
                onConfirm={confirmDeleteRoadmap}
                title="Delete Roadmap?"
                message={`Are you sure you want to delete "${roadmaps.find(r => r.id === roadmapToDelete)?.name || 'this roadmap'}"? All phases and progress within it will be permanently lost.`}
                confirmText="Delete"
                confirmIcon="fa-trash"
            />

            <SmallConfirmModal
                isOpen={showCompleteAllModal}
                onClose={() => setShowCompleteAllModal(false)}
                onConfirm={confirmMarkAllComplete}
                title="Complete All Items?"
                message="This will mark all items in the current phase as complete."
                confirmText="Complete All"
                confirmIcon="fa-check-double"
            />

            <SmallConfirmModal
                isOpen={showResetAllModal}
                onClose={() => setShowResetAllModal(false)}
                onConfirm={confirmMarkAllIncomplete}
                title="Reset All Progress?"
                message="This will reset all items in the current phase to incomplete."
                confirmText="Reset All"
                confirmIcon="fa-undo"
            />

            <RenameRoadmapModal
                isOpen={showRenamePhaseModal}
                onClose={() => { setShowRenamePhaseModal(false); setPhaseToRenameIndex(null); }}
                onRename={confirmRenamePhase}
                currentName={phaseToRenameIndex !== null && phases[phaseToRenameIndex] ? phases[phaseToRenameIndex].data.phase : ''}
            />

            <SmallConfirmModal
                isOpen={showDeletePhaseModal}
                onClose={() => { setShowDeletePhaseModal(false); setPhaseToDelete(null); }}
                onConfirm={confirmDeletePhase}
                title="Delete Phase?"
                message="Are you sure you want to delete this phase? This action cannot be undone."
                confirmText="Delete"
                confirmIcon="fa-trash"
            />

            <InfoModal
                isOpen={showInfoModal}
                onClose={() => { setShowInfoModal(false); setSelectedInfoNode(null); }}
                node={selectedInfoNode}
            />

            <EditModal
                isOpen={showEditModal}
                onClose={() => { setShowEditModal(false); setSelectedEditNode(null); }}
                node={selectedEditNode}
                onSave={handleSaveEdit}
            />

            {showGlobalSearch && (
                <GlobalSearchResults
                    searchTerm={searchTerm}
                    phases={phases}
                    onNodeClick={handleGlobalSearchNodeClick}
                    onClose={handleCloseGlobalSearch}
                    onSearchChange={setSearchTerm}
                />
            )}

            <div className="toast-container">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>

            {showScrollTop && (
                <button className="scroll-to-top" onClick={scrollToTop} title="Scroll to top">
                    <i className="fas fa-arrow-up"></i>
                </button>
            )}

            {phases.length > 0 && (
                <button
                    className="global-search-trigger"
                    onClick={handleOpenGlobalSearch}
                    title="Search across all phases"
                >
                    <i className="fas fa-search"></i>
                </button>
            )}
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
