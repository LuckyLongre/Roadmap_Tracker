// ============= UTILITY FUNCTIONS =============
const generateId = (parentId, index) => {
    return parentId ? `${parentId}.${index + 1}` : `${index + 1}`;
};

const detectNodeType = (node, level) => {
    if (node.phase) return 'phase';
    if (node.sections) return 'section-container';
    if (node.topics) return 'section';
    if (node.subtopics) return 'topic';
    if (node.concepts) return 'subtopic';
    if (node.details || node.practicalExamples || node.technicalConcepts) return 'concept';
    return 'detail';
};

// ============= COPY UTILITY FUNCTIONS =============
const hasNestedChildren = (node) => {
    return node.children.some(child => child.children.length > 0);
};

const formatCopyContent = (node) => {
    if (node.children.length === 0) {
        return node.title;
    }
    
    if (hasNestedChildren(node)) {
        return node.title;
    }
    
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
        this.id = generateId(parentId, index);
        this.originalId = data.id || this.id;
        this.type = detectNodeType(data, level);
        this.title = data.title || data.name || data.type || data.protocol || 'Untitled';
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

        if (node.concepts && Array.isArray(node.concepts)) {
            node.concepts.forEach((concept, idx) => {
                const conceptNode = new TreeNode(concept, parentNode.id, level + 1, idx);
                parentNode.addChild(conceptNode);
                processNode(concept, conceptNode, level + 1);
            });
        }

        const detailKeys = [
            'details', 'practicalExamples', 'technicalConcepts', 'performanceFactors',
            'characteristics', 'useCases', 'importance', 'features', 'types', 'performanceImpact'
        ];

        detailKeys.forEach(key => {
            if (node[key] && Array.isArray(node[key])) {
                node[key].forEach((detail, idx) => {
                    const detailData = typeof detail === 'string'
                        ? { title: detail, type: key }
                        : { ...detail, type: key };
                    const detailNode = new TreeNode(detailData, parentNode.id, level + 1, idx);
                    parentNode.addChild(detailNode);

                    if (typeof detail === 'object' && detail !== null) {
                        processNode(detail, detailNode, level + 1);
                    }
                });
            }
        });
    };

    processNode(data, root, 0);
    return root;
};

// ============= STORAGE SERVICE =============
const StorageService = {
    STORAGE_KEY: 'learning_tracker_data_v3',

    saveProgress(phases) {
        try {
            const data = phases.map(phase => ({
                data: phase.data,
                completionMap: this.serializeCompletionMap(phase.root)
            }));
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving progress:', error);
            return false;
        }
    },

    loadProgress() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading progress:', error);
            return [];
        }
    },

    serializeCompletionMap(node) {
        const map = {};
        const traverse = (n) => {
            map[n.id] = {
                completed: n.completed,
                expanded: n.expanded
            };
            n.children.forEach(traverse);
        };
        traverse(node);
        return map;
    },

    applyCompletionMap(node, completionMap) {
        const traverse = (n) => {
            if (completionMap[n.id]) {
                n.completed = completionMap[n.id].completed;
                n.expanded = completionMap[n.id].expanded;
            }
            n.children.forEach(traverse);
        };
        traverse(node);
    },

    exportProgress(phases) {
        // Export complete phase data along with progress
        const exportData = {
            exportVersion: '1.0',
            exportDate: new Date().toISOString(),
            appName: 'LearnPath - Visual Learning Tracker',
            phases: phases.map((phase, index) => ({
                index: index,
                data: phase.data, // Complete original phase data
                completionMap: this.serializeCompletionMap(phase.root),
                metadata: {
                    totalNodes: this.countNodes(phase.root),
                    completedNodes: this.countCompletedNodes(phase.root),
                    progressPercentage: phase.root.calculateProgress()
                }
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `learnpath-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return true;
    },

    importProgress(importData) {
        // Validate import data structure
        if (!importData.exportVersion || importData.exportVersion !== '1.0') {
            throw new Error('Invalid export file format');
        }
        
        if (!importData.phases || !Array.isArray(importData.phases)) {
            throw new Error('Invalid export file structure');
        }

        return importData.phases;
    },

    countNodes(node) {
        let count = 1;
        node.children.forEach(child => {
            count += this.countNodes(child);
        });
        return count;
    },

    countCompletedNodes(node) {
        let count = node.completed ? 1 : 0;
        node.children.forEach(child => {
            count += this.countCompletedNodes(child);
        });
        return count;
    },

    clearAllProgress() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Error clearing progress:', error);
            return false;
        }
    }
};

// ============= REACT COMPONENTS =============
const TreeNodeComponent = ({ node, onToggle, onCheck, searchTerm, onCopy }) => {
    const [copyState, setCopyState] = React.useState('default');

    const handleToggle = (e) => {
        e.stopPropagation();
        if (onToggle && node.children.length > 0) {
            onToggle(node, !node.expanded);
        }
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
            if (onCopy) {
                onCopy('success', `Copied: ${node.title}`);
            }
            setTimeout(() => setCopyState('default'), 2000);
        } else {
            setCopyState('error');
            if (onCopy) {
                onCopy('error', 'Failed to copy to clipboard');
            }
            setTimeout(() => setCopyState('default'), 2000);
        }
    };

    const completionState = node.getCompletionState();
    const progress = node.calculateProgress();
    const shouldHighlight = searchTerm &&
        node.title.toLowerCase().includes(searchTerm.toLowerCase());

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
                                        node.type === 'subtopic' ? 'bookmark' :
                                        node.type === 'concept' ? 'lightbulb' : 'circle'
                                    }`}></i>
                                    {node.type}
                                </span>
                                {node.children.length > 0 && (
                                    <span className="node-badge">
                                        <i className="fas fa-sitemap"></i>
                                        {node.children.length} items
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="node-right">
                        <button
                            className={`node-copy-btn ${copyState === 'copied' ? 'copied' : ''}`}
                            onClick={handleCopy}
                            title={copyState === 'copied' ? 'Copied!' : 'Copy to clipboard'}
                        >
                            <i className={`fas ${getCopyIcon()}`}></i>
                        </button>
                        {node.children.length > 0 && (
                            <>
                                <div className="progress-bar-container">
                                    <div
                                        className="progress-bar-fill"
                                        style={{ width: `${progress}%` }}
                                    ></div>
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
                <circle
                    className="progress-circle-bg"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                />
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

const PhaseListItem = ({ phase, index, isActive, onClick, onDelete }) => {
    const progress = phase.root.calculateProgress();

    return (
        <div
            className={`phase-item ${isActive ? 'active' : ''}`}
            onClick={() => onClick(index)}
        >
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
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(index);
                }}
                title="Delete this phase"
            >
                <i className="fas fa-trash"></i>
            </button>
            
        </div>
    );
};

const UploadModal = ({ isOpen, onClose, onUpload }) => {
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
        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        handleFile(file);
    };

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
    const [importMode, setImportMode] = React.useState('append'); // 'append' or 'overwrite'
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
                    setSelectedFile(file.name);
                    setFileData(json);
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
        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        handleFile(file);
    };

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
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    File loaded successfully. Choose import mode below.
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500', fontSize: '0.875rem' }}>
                                    Import Mode:
                                </label>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'flex-start', 
                                            gap: '0.75rem', 
                                            padding: '1rem', 
                                            background: importMode === 'append' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)', 
                                            border: `2px solid ${importMode === 'append' ? 'var(--primary)' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="importMode"
                                            value="append"
                                            checked={importMode === 'append'}
                                            onChange={(e) => setImportMode(e.target.value)}
                                            style={{ marginTop: '0.25rem' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                                <i className="fas fa-plus-circle" style={{ marginRight: '0.5rem', color: 'var(--success)' }}></i>
                                                Append (Add to Existing)
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                Keep existing phases and add new ones. If same phase exists, it will be overwritten.
                                            </div>
                                        </div>
                                    </label>

                                    <label 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'flex-start', 
                                            gap: '0.75rem', 
                                            padding: '1rem', 
                                            background: importMode === 'overwrite' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)', 
                                            border: `2px solid ${importMode === 'overwrite' ? 'var(--primary)' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="importMode"
                                            value="overwrite"
                                            checked={importMode === 'overwrite'}
                                            onChange={(e) => setImportMode(e.target.value)}
                                            style={{ marginTop: '0.25rem' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                                <i className="fas fa-sync-alt" style={{ marginRight: '0.5rem', color: 'var(--warning)' }}></i>
                                                Overwrite (Replace All)
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                Delete all existing phases and replace with imported data.
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-muted)', borderLeft: '3px solid var(--primary)' }}>
                                <i className="fas fa-info-circle" style={{ marginRight: '0.5rem' }}></i>
                                <strong>Tip:</strong> In Append mode, if a phase with the same name already exists, it will be replaced with the imported version.
                            </div>
                        </>
                    )}
                </div>
                {selectedFile && (
                    <div className="modal-footer">
                        <button 
                            className="btn btn-secondary" 
                            onClick={handleCancel}
                        >
                            Cancel
                        </button>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleImportConfirm}
                        >
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
                        <div className="delete-icon">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <h4 className="delete-title">Delete All Progress?</h4>
                        <p className="delete-message">
                            This will permanently delete all your learning progress.
                            This action cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-danger" onClick={onConfirm}>
                        <i className="fas fa-trash"></i> Delete All
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

const SearchResults = ({ searchTerm, activePhase, onNodeClick }) => {
    if (!searchTerm || !activePhase) return null;

    const term = searchTerm.toLowerCase();
    const getAllNodes = (node) => {
        let nodes = [node];
        node.children.forEach(child => {
            nodes = nodes.concat(getAllNodes(child));
        });
        return nodes;
    };

    const allNodes = getAllNodes(activePhase.root);
    const matchingNodes = allNodes.filter(node =>
        node.title.toLowerCase().includes(term) && node.id !== activePhase.root.id
    );

    if (matchingNodes.length === 0) {
        return (
            <div className="search-results">
                <div className="search-results-header">
                    <i className="fas fa-search"></i>
                    <span>No results found for "{searchTerm}"</span>
                </div>
            </div>
        );
    }

    const getNodePath = (node) => {
        const path = [];
        let current = node.parent;
        while (current && current.id !== activePhase.root.id) {
            path.unshift(current.title);
            current = current.parent;
        }
        return path;
    };

    return (
        <div className="search-results">
            <div className="search-results-header">
                <i className="fas fa-search"></i>
                <span>{matchingNodes.length} result{matchingNodes.length !== 1 ? 's' : ''} found</span>
            </div>
            <div className="search-results-list">
                {matchingNodes.map((node) => {
                    const path = getNodePath(node);
                    const progress = node.calculateProgress();

                    return (
                        <div
                            key={node.id}
                            className="search-result-item"
                            onClick={() => onNodeClick(node)}
                        >
                            <div className="search-result-content">
                                <div className="search-result-title">
                                    <i className={`fas fa-${
                                        node.type === 'phase' ? 'layer-group' :
                                        node.type === 'section' ? 'folder' :
                                        node.type === 'topic' ? 'book' :
                                        node.type === 'subtopic' ? 'bookmark' :
                                        node.type === 'concept' ? 'lightbulb' : 'circle'
                                    }`}></i>
                                    {node.title}
                                </div>
                                {path.length > 0 && (
                                    <div className="search-result-path">
                                        {path.join(' > ')}
                                    </div>
                                )}
                                <div className="search-result-meta">
                                    <span className="search-result-badge">{node.type}</span>
                                    {node.children.length > 0 && (
                                        <>
                                            <span className="search-result-badge">
                                                {node.children.length} items
                                            </span>
                                            <span className="search-result-badge">
                                                {progress.toFixed(0)}% complete
                                            </span>
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
        </div>
    );
};

// ============= MAIN APP =============
const App = () => {
    const [phases, setPhases] = React.useState([]);
    const [activePhaseIndex, setActivePhaseIndex] = React.useState(null);
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [showImportModal, setShowImportModal] = React.useState(false);
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [toasts, setToasts] = React.useState([]);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState({
        progress: false,
        phases: false
    });
    const [headerCollapsed, setHeaderCollapsed] = React.useState(false);
    const [controlsCollapsed, setControlsCollapsed] = React.useState(false);
    const [showScrollTop, setShowScrollTop] = React.useState(false);

    React.useEffect(() => {
        const savedData = StorageService.loadProgress();
        if (savedData && savedData.length > 0) {
            const loadedPhases = savedData.map(phaseData => {
                const root = buildTree(phaseData.data);
                if (phaseData.completionMap) {
                    StorageService.applyCompletionMap(root, phaseData.completionMap);
                }
                return { data: phaseData.data, root };
            });
            setPhases(loadedPhases);
            setActivePhaseIndex(0);
        }
    }, []);

    React.useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const treeViewport = document.querySelector('.tree-viewport');
            const treeScroll = treeViewport ? treeViewport.scrollTop : 0;
            setShowScrollTop(scrollY > 300 || treeScroll > 300);
        };

        window.addEventListener('scroll', handleScroll);

        const treeViewport = document.querySelector('.tree-viewport');
        if (treeViewport) {
            treeViewport.addEventListener('scroll', handleScroll);
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (treeViewport) {
                treeViewport.removeEventListener('scroll', handleScroll);
            }
        };
    }, [phases, activePhaseIndex]);

    React.useEffect(() => {
        if (phases.length > 0) {
            StorageService.saveProgress(phases);
        }
    }, [phases]);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleUpload = (data) => {
        try {
            if (Array.isArray(data)) {
                const newPhases = data.map(phaseData => {
                    const root = buildTree(phaseData);
                    return { data: phaseData, root };
                });
                setPhases(prev => [...prev, ...newPhases]);
                setActivePhaseIndex(phases.length);
                addToast(`Successfully loaded ${newPhases.length} phase(s)`, 'success');
            } else {
                const root = buildTree(data);
                setPhases(prev => [...prev, { data, root }]);
                setActivePhaseIndex(phases.length);
                addToast('Learning path loaded successfully', 'success');
            }
        } catch (error) {
            console.error('Error processing upload:', error);
            addToast('Error loading file. Please check the format.', 'error');
        }
    };

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
        const newValue = !node.completed;
        setNodeAndChildren(node, newValue);
        updateParents(node);
        setPhases([...phases]);
    };

    const handleToggleNode = (node, expanded) => {
        node.expanded = expanded;
        setPhases([...phases]);
    };

    const handleCopyNode = (type, message) => {
        addToast(message, type);
    };

    const handleDeletePhase = (index) => {
        const newPhases = phases.filter((_, i) => i !== index);
        setPhases(newPhases);
        if (activePhaseIndex === index) {
            setActivePhaseIndex(newPhases.length > 0 ? 0 : null);
        } else if (activePhaseIndex > index) {
            setActivePhaseIndex(activePhaseIndex - 1);
        }
        addToast('Phase deleted successfully', 'success');
    };

    const handleDeleteAllProgress = () => {
        StorageService.clearAllProgress();
        setPhases([]);
        setActivePhaseIndex(null);
        setShowDeleteModal(false);
        addToast('All progress deleted', 'success');
    };

    const handleExportProgress = () => {
        if (phases.length > 0) {
            StorageService.exportProgress(phases);
            addToast('Progress exported successfully', 'success');
        }
    };

    const handleImport = (importData, mode = 'append') => {
        try {
            const importedPhases = StorageService.importProgress(importData);
            
            // Reconstruct phases from imported data
            const loadedPhases = importedPhases.map(phaseData => {
                const root = buildTree(phaseData.data);
                if (phaseData.completionMap) {
                    StorageService.applyCompletionMap(root, phaseData.completionMap);
                }
                return { data: phaseData.data, root };
            });

            let finalPhases = [];
            let message = '';

            if (mode === 'overwrite') {
                // Replace all existing phases with imported ones
                finalPhases = loadedPhases;
                message = `Replaced all phases with ${loadedPhases.length} imported phase${loadedPhases.length !== 1 ? 's' : ''}`;
            } else {
                // Append mode with collision handling
                finalPhases = [...phases];
                let addedCount = 0;
                let replacedCount = 0;

                loadedPhases.forEach(importedPhase => {
                    // Check if phase with same name already exists
                    const existingIndex = finalPhases.findIndex(
                        p => p.data.phase === importedPhase.data.phase
                    );

                    if (existingIndex !== -1) {
                        // Replace existing phase with imported one
                        finalPhases[existingIndex] = importedPhase;
                        replacedCount++;
                    } else {
                        // Add new phase
                        finalPhases.push(importedPhase);
                        addedCount++;
                    }
                });

                if (replacedCount > 0 && addedCount > 0) {
                    message = `Added ${addedCount} new phase${addedCount !== 1 ? 's' : ''} and replaced ${replacedCount} existing phase${replacedCount !== 1 ? 's' : ''}`;
                } else if (replacedCount > 0) {
                    message = `Replaced ${replacedCount} existing phase${replacedCount !== 1 ? 's' : ''}`;
                } else {
                    message = `Added ${addedCount} new phase${addedCount !== 1 ? 's' : ''}`;
                }
            }

            // Set phases and update active index
            setPhases(finalPhases);
            if (finalPhases.length > 0 && (activePhaseIndex === null || mode === 'overwrite')) {
                setActivePhaseIndex(0);
            }
            
            addToast(message, 'success');
        } catch (error) {
            console.error('Import failed:', error);
            addToast(error.message || 'Failed to import progress', 'error');
        }
    };

    const expandAll = () => {
        if (activePhase) {
            const expandNode = (node) => {
                node.expanded = true;
                node.children.forEach(expandNode);
            };
            expandNode(activePhase.root);
            setPhases([...phases]);
        }
    };

    const collapseAll = () => {
        if (activePhase) {
            const collapseNode = (node) => {
                node.expanded = false;
                node.children.forEach(collapseNode);
            };
            collapseNode(activePhase.root);
            setPhases([...phases]);
        }
    };

    const markAllComplete = () => {
        if (activePhase) {
            setNodeAndChildren(activePhase.root, true);
            setPhases([...phases]);
            addToast('All items marked as complete', 'success');
        }
    };

    const markAllIncomplete = () => {
        if (activePhase) {
            setNodeAndChildren(activePhase.root, false);
            setPhases([...phases]);
            addToast('All items reset', 'success');
        }
    };

    const toggleSidebarSection = (section) => {
        setSidebarCollapsed(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const scrollToNode = (node) => {
        let current = node.parent;
        while (current) {
            current.expanded = true;
            current = current.parent;
        }

        node.highlighted = true;
        setPhases([...phases]);

        setTimeout(() => {
            const element = document.querySelector(`[data-node-id="${node.id}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);

        setTimeout(() => {
            node.highlighted = false;
            setPhases([...phases]);
        }, 2000);
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const treeViewport = document.querySelector('.tree-viewport');
        if (treeViewport) {
            treeViewport.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const activePhase = activePhaseIndex !== null ? phases[activePhaseIndex] : null;

    const getAllNodes = (node) => {
        let nodes = [node];
        node.children.forEach(child => {
            nodes = nodes.concat(getAllNodes(child));
        });
        return nodes;
    };

    const calculateOverallProgress = () => {
        if (phases.length === 0) return 0;

        const leafNodes = [];
        phases.forEach(phase => {
            getAllNodes(phase.root).forEach(n => {
                if (n.isLeaf()) leafNodes.push(n);
            });
        });

        if (leafNodes.length === 0) return 0;

        const completedCount = leafNodes.filter(n => n.completed).length;
        return (completedCount / leafNodes.length) * 100;
    };

    const progress = calculateOverallProgress();

    const calculateStats = () => {
        if (phases.length === 0) return { total: 0, completed: 0 };

        const leafNodes = [];
        phases.forEach(phase => {
            getAllNodes(phase.root).forEach(n => {
                if (n.isLeaf()) leafNodes.push(n);
            });
        });

        return {
            total: leafNodes.length,
            completed: leafNodes.filter(n => n.completed).length
        };
    };

    const stats = calculateStats();
    const totalNodes = stats.total;
    const completedNodes = stats.completed;

    const getFilteredNodes = () => {
        if (!activePhase || !searchTerm) {
            return activePhase ? activePhase.root.children : [];
        }

        const term = searchTerm.toLowerCase();
        const allNodes = getAllNodes(activePhase.root);
        const matchingNodes = allNodes.filter(node =>
            node.title.toLowerCase().includes(term)
        );

        matchingNodes.forEach(node => {
            let current = node.parent;
            while (current) {
                current.expanded = true;
                current = current.parent;
            }
        });

        return activePhase.root.children;
    };

    const filteredChildren = getFilteredNodes();

    return (
        <div className="app-container">
            <header className={`app-header ${headerCollapsed ? 'collapsed' : ''}`}>
                <div className="header-wrapper">
                    {headerCollapsed && (
                        <div className="compact-header">
                            <div className="compact-logo">
                                <i className="fas fa-graduation-cap"></i>
                                <span>LearnPath</span>
                            </div>
                            <button
                                className="header-toggle-btn"
                                onClick={() => setHeaderCollapsed(false)}
                            >
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

                                <div className="action-buttons">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowUploadModal(true)}
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
                                    {phases.length > 0 && (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="header-toggle">
                                <button
                                    className="header-toggle-btn"
                                    onClick={() => setHeaderCollapsed(true)}
                                >
                                    <span>Hide Menu</span>
                                    <i className="fas fa-chevron-up header-toggle-icon"></i>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </header>

            <main className="app-main">
                {phases.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <i className="fas fa-road"></i>
                        </div>
                        <h2 className="empty-title">No Learning Paths Yet</h2>
                        <p className="empty-description">
                            Upload a JSON roadmap to start tracking your learning progress.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowUploadModal(true)}
                            >
                                <i className="fas fa-upload"></i> Upload Your First Roadmap
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowImportModal(true)}
                            >
                                <i className="fas fa-file-import"></i> Import Progress
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="dashboard">
                        <div className="sidebar">
                            <div className={`sidebar-card ${sidebarCollapsed.progress ? 'collapsed' : ''}`}>
                                <div className="sidebar-header">
                                    <h3 className="sidebar-title">
                                        <i className="fas fa-chart-pie"></i> Progress
                                    </h3>
                                    <button
                                        className="toggle-btn"
                                        onClick={() => toggleSidebarSection('progress')}
                                    >
                                        <i className={`fas fa-chevron-${sidebarCollapsed.progress ? 'down' : 'up'}`}></i>
                                    </button>
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
                                    </div>
                                </div>
                            </div>

                            <div className={`sidebar-card ${sidebarCollapsed.phases ? 'collapsed' : ''}`}>
                                <div className="sidebar-header">
                                    <h3 className="sidebar-title">
                                        <i className="fas fa-list"></i> Phases
                                    </h3>
                                    <button
                                        className="toggle-btn"
                                        onClick={() => toggleSidebarSection('phases')}
                                    >
                                        <i className={`fas fa-chevron-${sidebarCollapsed.phases ? 'down' : 'up'}`}></i>
                                    </button>
                                </div>
                                <div className="sidebar-content">
                                    <div className="phase-list">
                                        {phases.map((phase, idx) => (
                                            <PhaseListItem
                                                key={idx}
                                                phase={phase}
                                                index={idx}
                                                isActive={idx === activePhaseIndex}
                                                onClick={setActivePhaseIndex}
                                                onDelete={handleDeletePhase}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="main-content">
                            <div className={`content-header ${controlsCollapsed ? 'collapsed' : ''}`}>
                                <div className="content-header-main">
                                    <div className="content-title">
                                        <h2>{activePhase?.data.phase || 'No Phase Selected'}</h2>
                                        <p className="content-subtitle">{activePhase?.data.title || 'Select a phase to view'}</p>
                                    </div>

                                    <button
                                        className="toggle-btn"
                                        onClick={() => setControlsCollapsed(!controlsCollapsed)}
                                        title={controlsCollapsed ? "Show controls" : "Hide controls"}
                                    >
                                        <i className={`fas fa-chevron-${controlsCollapsed ? 'down' : 'up'}`}></i>
                                    </button>
                                </div>

                                {!controlsCollapsed && (
                                    <div className="search-box">
                                        <i className="fas fa-search search-icon"></i>
                                        <input
                                            type="text"
                                            className="search-input"
                                            placeholder="Search topics..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                )}
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

                                {searchTerm && (
                                    <SearchResults
                                        searchTerm={searchTerm}
                                        activePhase={activePhase}
                                        onNodeClick={scrollToNode}
                                    />
                                )}

                                <div className="tree-viewport">
                                    {filteredChildren.length > 0 ? (
                                        filteredChildren.map((node) => (
                                            <TreeNodeComponent
                                                key={node.id}
                                                node={node}
                                                onToggle={handleToggleNode}
                                                onCheck={handleCheckNode}
                                                searchTerm={searchTerm}
                                                onCopy={handleCopyNode}
                                            />
                                        ))
                                    ) : (
                                        <div className="empty-state">
                                            <div className="empty-icon">
                                                <i className="fas fa-tree"></i>
                                            </div>
                                            <h3 className="empty-title">No content available</h3>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUpload={handleUpload}
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
                <button
                    className="scroll-to-top"
                    onClick={scrollToTop}
                    title="Scroll to top"
                >
                    <i className="fas fa-arrow-up"></i>
                </button>
            )}
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
