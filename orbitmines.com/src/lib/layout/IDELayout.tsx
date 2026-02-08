import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Icon } from '@blueprintjs/core';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SplitNode {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  children: LayoutNode[];
  sizes: number[];
}

export interface TabGroupNode {
  type: 'tabgroup';
  id: string;
  panels: string[];
  activeIndex: number;
}

export type LayoutNode = SplitNode | TabGroupNode;

export interface PanelDefinition {
  id: string;
  title: string;
  icon?: string;
  render: () => React.ReactNode;
  closable?: boolean;
}

export type DropZoneType = 'tab' | 'left' | 'right' | 'top' | 'bottom';

export interface DropZone {
  targetId: string;
  type: DropZoneType;
}

interface DragState {
  panelId: string;
  sourceGroupId: string;
}

// ─── ID Generation ───────────────────────────────────────────────────────────

let _idCounter = 0;
export function generateId(): string {
  return `ide-${++_idCounter}`;
}

// ─── Tree Utilities ──────────────────────────────────────────────────────────

export function findNode(root: LayoutNode, id: string): LayoutNode | null {
  if (root.id === id) return root;
  if (root.type === 'split') {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function findParent(
  root: LayoutNode,
  id: string
): { parent: SplitNode; index: number } | null {
  if (root.type === 'split') {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === id) {
        return { parent: root, index: i };
      }
      const found = findParent(root.children[i], id);
      if (found) return found;
    }
  }
  return null;
}

export function replaceNode(
  root: LayoutNode,
  targetId: string,
  replacement: LayoutNode
): LayoutNode {
  if (root.id === targetId) return replacement;
  if (root.type === 'split') {
    return {
      ...root,
      children: root.children.map((child) =>
        replaceNode(child, targetId, replacement)
      ),
    };
  }
  return root;
}

export function removePanelFromNode(
  root: LayoutNode,
  groupId: string,
  panelId: string
): LayoutNode {
  if (root.type === 'tabgroup' && root.id === groupId) {
    const newPanels = root.panels.filter((p) => p !== panelId);
    const newActive = Math.min(root.activeIndex, Math.max(0, newPanels.length - 1));
    return { ...root, panels: newPanels, activeIndex: newActive };
  }
  if (root.type === 'split') {
    return {
      ...root,
      children: root.children.map((child) =>
        removePanelFromNode(child, groupId, panelId)
      ),
    };
  }
  return root;
}

export function normalizeTree(node: LayoutNode): LayoutNode | null {
  if (node.type === 'tabgroup') {
    return node.panels.length === 0 ? null : node;
  }

  // Recurse into children first
  const normalizedChildren: LayoutNode[] = [];
  const normalizedSizes: number[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const result = normalizeTree(node.children[i]);
    if (result) {
      normalizedChildren.push(result);
      normalizedSizes.push(node.sizes[i]);
    }
  }

  if (normalizedChildren.length === 0) return null;
  if (normalizedChildren.length === 1) return normalizedChildren[0];

  // Renormalize sizes to sum to 1.0
  const sizeSum = normalizedSizes.reduce((a, b) => a + b, 0);
  const correctedSizes = normalizedSizes.map((s) => s / sizeSum);

  // Flatten same-direction nested splits
  const flatChildren: LayoutNode[] = [];
  const flatSizes: number[] = [];
  for (let i = 0; i < normalizedChildren.length; i++) {
    const child = normalizedChildren[i];
    if (child.type === 'split' && child.direction === node.direction) {
      for (let j = 0; j < child.children.length; j++) {
        flatChildren.push(child.children[j]);
        flatSizes.push(correctedSizes[i] * child.sizes[j]);
      }
    } else {
      flatChildren.push(child);
      flatSizes.push(correctedSizes[i]);
    }
  }

  return {
    ...node,
    children: flatChildren,
    sizes: flatSizes,
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface IDELayoutContextValue {
  panelRegistry: Map<string, PanelDefinition>;
  dragState: DragState | null;
  setDragState: (state: DragState | null) => void;
  dropZone: DropZone | null;
  setDropZone: (zone: DropZone | null) => void;
  updateLayout: (updater: (root: LayoutNode) => LayoutNode) => void;
  setActiveTab: (groupId: string, index: number) => void;
  movePanelToTabGroup: (
    panelId: string,
    sourceGroupId: string,
    targetGroupId: string
  ) => void;
  splitAndPlace: (
    panelId: string,
    sourceGroupId: string,
    targetGroupId: string,
    edge: 'left' | 'right' | 'top' | 'bottom'
  ) => void;
  closePanel: (groupId: string, panelId: string) => void;
  minPanelSize: number;
}

const IDELayoutContext = createContext<IDELayoutContextValue | null>(null);

function useIDELayout(): IDELayoutContextValue {
  const ctx = useContext(IDELayoutContext);
  if (!ctx) throw new Error('useIDELayout must be used within IDELayout');
  return ctx;
}

// ─── ResizeHandle ────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  parentId: string;
  index: number; // handle between children[index] and children[index+1]
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({
  direction,
  parentId,
  index,
}) => {
  const { updateLayout, minPanelSize } = useIDELayout();
  const [active, setActive] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setActive(true);

      const startPos = direction === 'horizontal' ? e.clientX : e.clientY;

      // Find the parent split container element to get its size
      const handleEl = handleRef.current;
      if (!handleEl) return;
      const containerEl = handleEl.parentElement;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();
      const containerSize =
        direction === 'horizontal' ? containerRect.width : containerRect.height;

      // Account for handle widths: total handle space = (numChildren - 1) * 4
      // We need a snapshot of sizes at mousedown
      let startSizes: number[] | null = null;

      updateLayout((root) => {
        const node = findNode(root, parentId);
        if (node && node.type === 'split') {
          startSizes = [...node.sizes];
        }
        return root; // no mutation, just reading
      });

      if (!startSizes) return;
      const capturedStartSizes = startSizes as number[];

      const onMouseMove = (moveEvent: MouseEvent) => {
        const currentPos =
          direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
        const deltaPx = currentPos - startPos;
        const numHandles = capturedStartSizes.length - 1;
        const availableSize = containerSize - numHandles * 4;
        const deltaFraction = deltaPx / availableSize;

        updateLayout((root) => {
          const node = findNode(root, parentId);
          if (!node || node.type !== 'split') return root;

          const newSizes = [...capturedStartSizes];
          let newLeft = newSizes[index] + deltaFraction;
          let newRight = newSizes[index + 1] - deltaFraction;

          // Clamp to minimum sizes
          if (newLeft < minPanelSize) {
            const diff = minPanelSize - newLeft;
            newLeft = minPanelSize;
            newRight -= diff;
          }
          if (newRight < minPanelSize) {
            const diff = minPanelSize - newRight;
            newRight = minPanelSize;
            newLeft -= diff;
          }

          newSizes[index] = newLeft;
          newSizes[index + 1] = newRight;

          return replaceNode(root, parentId, {
            ...node,
            sizes: newSizes,
          });
        });
      };

      const onMouseUp = () => {
        setActive(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, parentId, index, updateLayout, minPanelSize]
  );

  return (
    <div
      ref={handleRef}
      className={`ide-resize-handle ide-resize-handle--${direction}${active ? ' ide-resize-handle--active' : ''}`}
      onMouseDown={onMouseDown}
    />
  );
};

// ─── DropIndicator ───────────────────────────────────────────────────────────

interface DropIndicatorProps {
  type: DropZoneType;
}

const DropIndicator: React.FC<DropIndicatorProps> = ({ type }) => {
  let style: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 100,
  };

  switch (type) {
    case 'tab':
      style = { ...style, top: 0, left: 0, right: 0, bottom: 0 };
      break;
    case 'left':
      style = { ...style, top: 0, left: 0, bottom: 0, width: '50%' };
      break;
    case 'right':
      style = { ...style, top: 0, right: 0, bottom: 0, width: '50%' };
      break;
    case 'top':
      style = { ...style, top: 0, left: 0, right: 0, height: '50%' };
      break;
    case 'bottom':
      style = { ...style, bottom: 0, left: 0, right: 0, height: '50%' };
      break;
  }

  return <div className="ide-drop-indicator" style={style} />;
};

// ─── TabGroup ────────────────────────────────────────────────────────────────

interface TabGroupProps {
  node: TabGroupNode;
}

const TabGroup: React.FC<TabGroupProps> = ({ node }) => {
  const {
    panelRegistry,
    dragState,
    setDragState,
    dropZone,
    setDropZone,
    setActiveTab,
    movePanelToTabGroup,
    splitAndPlace,
    closePanel,
  } = useIDELayout();

  const containerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const activePanel = panelRegistry.get(node.panels[node.activeIndex]);
  const isDropTarget = dropZone && dropZone.targetId === node.id;

  const detectDropZone = useCallback(
    (e: React.DragEvent): DropZoneType | null => {
      if (!containerRef.current || !tabBarRef.current) return null;

      const tabBarRect = tabBarRef.current.getBoundingClientRect();
      // If over the tab bar, it's a tab merge
      if (e.clientY < tabBarRect.bottom) return 'tab';

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const threshold = 0.25;

      if (x < threshold) return 'left';
      if (x > 1 - threshold) return 'right';
      if (y < threshold) return 'top';
      if (y > 1 - threshold) return 'bottom';
      return 'tab';
    },
    []
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!dragState) return;
      // Don't allow dropping on the same single-tab group
      if (
        dragState.sourceGroupId === node.id &&
        node.panels.length === 1
      )
        return;

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const zone = detectDropZone(e);
      if (zone) {
        setDropZone({ targetId: node.id, type: zone });
      }
    },
    [dragState, node.id, node.panels.length, detectDropZone, setDropZone]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Only clear if we're actually leaving the container
      if (
        containerRef.current &&
        !containerRef.current.contains(e.relatedTarget as Node)
      ) {
        setDropZone(null);
      }
    },
    [setDropZone]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragState || !dropZone || dropZone.targetId !== node.id) {
        setDropZone(null);
        return;
      }

      const { panelId, sourceGroupId } = dragState;

      if (dropZone.type === 'tab') {
        movePanelToTabGroup(panelId, sourceGroupId, node.id);
      } else {
        splitAndPlace(
          panelId,
          sourceGroupId,
          node.id,
          dropZone.type as 'left' | 'right' | 'top' | 'bottom'
        );
      }

      setDropZone(null);
      setDragState(null);
    },
    [
      dragState,
      dropZone,
      node.id,
      movePanelToTabGroup,
      splitAndPlace,
      setDropZone,
      setDragState,
    ]
  );

  return (
    <div
      ref={containerRef}
      className="ide-tabgroup"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div ref={tabBarRef} className="ide-tabbar">
        {node.panels.map((panelId, i) => {
          const panel = panelRegistry.get(panelId);
          if (!panel) return null;

          return (
            <div
              key={panelId}
              className={`ide-tab${i === node.activeIndex ? ' ide-tab--active' : ''}${dragState?.panelId === panelId ? ' ide-tab--dragging' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', panelId);
                e.dataTransfer.effectAllowed = 'move';
                // Use setTimeout to avoid the drag image flash
                setTimeout(() => {
                  setDragState({ panelId, sourceGroupId: node.id });
                }, 0);
              }}
              onDragEnd={() => {
                setDragState(null);
                setDropZone(null);
              }}
              onClick={() => setActiveTab(node.id, i)}
            >
              {panel.icon && (
                <span className="ide-tab__icon">
                  <Icon icon={panel.icon as any} size={12} />
                </span>
              )}
              <span className="ide-tab__title">{panel.title}</span>
              {panel.closable !== false && (
                <span
                  className="ide-tab__close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closePanel(node.id, panelId);
                  }}
                >
                  <Icon icon="small-cross" size={12} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="ide-panel-content">
        {activePanel ? activePanel.render() : null}
      </div>

      {isDropTarget && <DropIndicator type={dropZone!.type} />}
    </div>
  );
};

// ─── SplitContainer ──────────────────────────────────────────────────────────

interface SplitContainerProps {
  node: SplitNode;
}

const SplitContainer: React.FC<SplitContainerProps> = ({ node }) => {
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < node.children.length; i++) {
    if (i > 0) {
      elements.push(
        <ResizeHandle
          key={`handle-${i}`}
          direction={node.direction}
          parentId={node.id}
          index={i - 1}
        />
      );
    }

    const size = node.sizes[i];
    const style: React.CSSProperties = {
      flex: `0 0 calc(${size * 100}% - ${((node.children.length - 1) * 4) / node.children.length}px)`,
      overflow: 'hidden',
    };

    elements.push(
      <div key={node.children[i].id} className="ide-split__child" style={style}>
        <LayoutNodeRenderer node={node.children[i]} />
      </div>
    );
  }

  return (
    <div className={`ide-split ide-split--${node.direction}`}>{elements}</div>
  );
};

// ─── LayoutNodeRenderer ──────────────────────────────────────────────────────

interface LayoutNodeRendererProps {
  node: LayoutNode;
}

const LayoutNodeRenderer: React.FC<LayoutNodeRendererProps> = ({ node }) => {
  switch (node.type) {
    case 'split':
      return <SplitContainer node={node} />;
    case 'tabgroup':
      return <TabGroup node={node} />;
    default:
      return null;
  }
};

// ─── IDELayout Root Component ────────────────────────────────────────────────

export interface IDELayoutProps {
  panels: PanelDefinition[];
  initialLayout: LayoutNode;
  minPanelSize?: number;
}

const IDELayout: React.FC<IDELayoutProps> = ({
  panels,
  initialLayout,
  minPanelSize = 0.05,
}) => {
  const [layout, setLayout] = useState<LayoutNode>(initialLayout);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  const panelRegistry = useMemo(() => {
    const map = new Map<string, PanelDefinition>();
    for (const panel of panels) {
      map.set(panel.id, panel);
    }
    return map;
  }, [panels]);

  const updateLayout = useCallback(
    (updater: (root: LayoutNode) => LayoutNode) => {
      setLayout((prev) => updater(prev));
    },
    []
  );

  const setActiveTab = useCallback(
    (groupId: string, index: number) => {
      setLayout((prev) => {
        const node = findNode(prev, groupId);
        if (!node || node.type !== 'tabgroup') return prev;
        return replaceNode(prev, groupId, {
          ...node,
          activeIndex: index,
        });
      });
    },
    []
  );

  const movePanelToTabGroup = useCallback(
    (panelId: string, sourceGroupId: string, targetGroupId: string) => {
      setLayout((prev) => {
        // Remove from source
        let tree = removePanelFromNode(prev, sourceGroupId, panelId);

        // Add to target
        const target = findNode(tree, targetGroupId);
        if (!target || target.type !== 'tabgroup') return prev;
        tree = replaceNode(tree, targetGroupId, {
          ...target,
          panels: [...target.panels, panelId],
          activeIndex: target.panels.length, // activate new tab
        });

        // Normalize
        return normalizeTree(tree) || tree;
      });
    },
    []
  );

  const splitAndPlace = useCallback(
    (
      panelId: string,
      sourceGroupId: string,
      targetGroupId: string,
      edge: 'left' | 'right' | 'top' | 'bottom'
    ) => {
      setLayout((prev) => {
        // Remove from source
        let tree = removePanelFromNode(prev, sourceGroupId, panelId);

        // Create new tab group for the dragged panel
        const newGroup: TabGroupNode = {
          type: 'tabgroup',
          id: generateId(),
          panels: [panelId],
          activeIndex: 0,
        };

        // Find the target to replace it with a split
        const target = findNode(tree, targetGroupId);
        if (!target) return prev;

        const direction: 'horizontal' | 'vertical' =
          edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
        const newFirst = edge === 'left' || edge === 'top';

        // Check if parent already splits in the same direction
        const parentInfo = findParent(tree, targetGroupId);
        if (parentInfo && parentInfo.parent.direction === direction) {
          // Flatten: insert into parent instead of nesting
          const { parent, index: targetIndex } = parentInfo;
          const newChildren = [...parent.children];
          const newSizes = [...parent.sizes];

          // Split the target's size in half
          const targetSize = newSizes[targetIndex];
          const insertIndex = newFirst ? targetIndex : targetIndex + 1;

          newChildren.splice(insertIndex, 0, newGroup);
          newSizes[targetIndex] = targetSize / 2;
          newSizes.splice(insertIndex, 0, targetSize / 2);

          tree = replaceNode(tree, parent.id, {
            ...parent,
            children: newChildren,
            sizes: newSizes,
          });
        } else {
          // Create new split node
          const newSplit: SplitNode = {
            type: 'split',
            id: generateId(),
            direction,
            children: newFirst ? [newGroup, target] : [target, newGroup],
            sizes: [0.5, 0.5],
          };

          tree = replaceNode(tree, targetGroupId, newSplit);
        }

        // Normalize
        return normalizeTree(tree) || tree;
      });
    },
    []
  );

  const closePanel = useCallback(
    (groupId: string, panelId: string) => {
      setLayout((prev) => {
        const tree = removePanelFromNode(prev, groupId, panelId);
        return normalizeTree(tree) || prev;
      });
    },
    []
  );

  const contextValue = useMemo<IDELayoutContextValue>(
    () => ({
      panelRegistry,
      dragState,
      setDragState,
      dropZone,
      setDropZone,
      updateLayout,
      setActiveTab,
      movePanelToTabGroup,
      splitAndPlace,
      closePanel,
      minPanelSize,
    }),
    [
      panelRegistry,
      dragState,
      dropZone,
      updateLayout,
      setActiveTab,
      movePanelToTabGroup,
      splitAndPlace,
      closePanel,
      minPanelSize,
    ]
  );

  return (
    <IDELayoutContext.Provider value={contextValue}>
      <div className="ide-layout">
        <LayoutNodeRenderer node={layout} />
      </div>
    </IDELayoutContext.Provider>
  );
};

export default IDELayout;
