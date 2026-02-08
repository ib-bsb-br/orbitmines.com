import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
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
  insertIndex?: number;
}

interface DragState {
  panelId: string;
  sourceGroupId: string;
}

interface CollapseRecord {
  panels: string[];
  removedGroupId: string;
  originalSize: number;
  originalIndex: number;
  parentSplitId: string;
  targetGroupId: string;
  insertPosition: 'before' | 'after';
  originalActiveIndex: number;
  collapsedAtDim: number;
  direction: 'horizontal' | 'vertical';
}

const MIN_COLLAPSE_HORIZONTAL_PX = 250;
const MIN_COLLAPSE_VERTICAL_PX = 120;
const RESTORE_HYSTERESIS_PX = 20;

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

export function findPanelInLayout(
  root: LayoutNode,
  panelId: string
): { groupId: string; index: number } | null {
  if (root.type === 'tabgroup') {
    const idx = root.panels.indexOf(panelId);
    if (idx !== -1) return { groupId: root.id, index: idx };
    return null;
  }
  if (root.type === 'split') {
    for (const child of root.children) {
      const found = findPanelInLayout(child, panelId);
      if (found) return found;
    }
  }
  return null;
}

// ─── Responsive Collapse Helpers ─────────────────────────────────────────────

function findEdgeTabGroup(
  node: LayoutNode,
  side: 'left' | 'right'
): TabGroupNode | null {
  if (node.type === 'tabgroup') return node;
  if (node.type === 'split') {
    if (node.children.length === 0) return null;
    const idx = side === 'left' ? 0 : node.children.length - 1;
    return findEdgeTabGroup(node.children[idx], side);
  }
  return null;
}

function findSmallestBelowThreshold(
  node: LayoutNode,
  availWidth: number,
  availHeight: number
): { childNode: LayoutNode; parentSplit: SplitNode; childIndex: number } | null {
  if (node.type !== 'split') return null;

  const isHoriz = node.direction === 'horizontal';
  const dim = isHoriz ? availWidth : availHeight;
  const threshold = isHoriz ? MIN_COLLAPSE_HORIZONTAL_PX : MIN_COLLAPSE_VERTICAL_PX;
  const handleSpace = (node.children.length - 1) * 4;
  const contentSpace = dim - handleSpace;

  // Recurse into children first (collapse deepest levels first)
  for (let i = 0; i < node.children.length; i++) {
    const childDim = contentSpace * node.sizes[i];
    const childW = isHoriz ? childDim : availWidth;
    const childH = isHoriz ? availHeight : childDim;
    const deeper = findSmallestBelowThreshold(
      node.children[i],
      childW,
      childH
    );
    if (deeper) return deeper;
  }

  // Check this level — only collapse tab group children
  if (node.children.length <= 1) return null;

  let smallestIndex = -1;
  let smallestPx = Infinity;

  for (let i = 0; i < node.children.length; i++) {
    const childPx = contentSpace * node.sizes[i];
    if (
      node.children[i].type === 'tabgroup' &&
      childPx < threshold &&
      childPx <= smallestPx
    ) {
      smallestPx = childPx;
      smallestIndex = i;
    }
  }

  if (smallestIndex !== -1) {
    return {
      childNode: node.children[smallestIndex],
      parentSplit: node,
      childIndex: smallestIndex,
    };
  }

  return null;
}

function performSingleCollapse(
  tree: LayoutNode,
  target: { childNode: LayoutNode; parentSplit: SplitNode; childIndex: number },
  containerWidth: number,
  containerHeight: number
): { tree: LayoutNode; record: CollapseRecord } | null {
  const { childNode, parentSplit, childIndex } = target;
  if (childNode.type !== 'tabgroup') return null;
  if (parentSplit.children.length <= 1) return null;

  // Find the largest sibling
  let largestIndex = -1;
  let largestSize = -1;
  for (let i = 0; i < parentSplit.children.length; i++) {
    if (i === childIndex) continue;
    if (parentSplit.sizes[i] > largestSize) {
      largestSize = parentSplit.sizes[i];
      largestIndex = i;
    }
  }
  if (largestIndex === -1) return null;

  const isFromLeft = childIndex < largestIndex;
  const targetTabGroup = findEdgeTabGroup(
    parentSplit.children[largestIndex],
    isFromLeft ? 'left' : 'right'
  );
  if (!targetTabGroup) return null;

  const currentTarget = findNode(tree, targetTabGroup.id) as TabGroupNode;
  if (!currentTarget || currentTarget.type !== 'tabgroup') return null;

  // Merge panels: prepend if from left, append if from right
  const newPanels = isFromLeft
    ? [...childNode.panels, ...currentTarget.panels]
    : [...currentTarget.panels, ...childNode.panels];

  // Keep the target's active tab selected
  const newActiveIndex = isFromLeft
    ? childNode.panels.length + currentTarget.activeIndex
    : currentTarget.activeIndex;

  let newTree = replaceNode(tree, targetTabGroup.id, {
    ...currentTarget,
    panels: newPanels,
    activeIndex: newActiveIndex,
  });

  // Remove the collapsed child from the parent split
  const currentParent = findNode(newTree, parentSplit.id) as SplitNode;
  if (!currentParent || currentParent.type !== 'split') return null;

  const newChildren = currentParent.children.filter((_, i) => i !== childIndex);
  const newSizes = currentParent.sizes.filter((_, i) => i !== childIndex);
  const sizeSum = newSizes.reduce((a, b) => a + b, 0);
  const normalizedSizes = newSizes.map((s) => s / sizeSum);

  newTree = replaceNode(newTree, parentSplit.id, {
    ...currentParent,
    children: newChildren,
    sizes: normalizedSizes,
  });

  const dim =
    parentSplit.direction === 'horizontal' ? containerWidth : containerHeight;

  const record: CollapseRecord = {
    panels: childNode.panels,
    removedGroupId: childNode.id,
    originalSize: parentSplit.sizes[childIndex],
    originalIndex: childIndex,
    parentSplitId: parentSplit.id,
    targetGroupId: targetTabGroup.id,
    insertPosition: isFromLeft ? 'before' : 'after',
    originalActiveIndex: childNode.activeIndex,
    collapsedAtDim: dim,
    direction: parentSplit.direction,
  };

  return { tree: newTree, record };
}

function tryRestoreRecord(
  tree: LayoutNode,
  record: CollapseRecord
): LayoutNode | null {
  const parentSplit = findNode(tree, record.parentSplitId);
  if (!parentSplit || parentSplit.type !== 'split') return null;

  const targetGroup = findNode(tree, record.targetGroupId);
  if (!targetGroup || targetGroup.type !== 'tabgroup') return null;

  // Position-based: take panels from the front or back based on how they
  // were inserted — this respects any reordering the user did while collapsed
  const panelCount = Math.min(record.panels.length, targetGroup.panels.length - 1);
  if (panelCount <= 0) return null;

  let panelsToRestore: string[];
  let remainingPanels: string[];

  if (record.insertPosition === 'before') {
    panelsToRestore = targetGroup.panels.slice(0, panelCount);
    remainingPanels = targetGroup.panels.slice(panelCount);
  } else {
    panelsToRestore = targetGroup.panels.slice(-panelCount);
    remainingPanels = targetGroup.panels.slice(0, -panelCount);
  }

  if (remainingPanels.length === 0) return null;

  // Keep the target's active panel selected
  const activePanel = targetGroup.panels[targetGroup.activeIndex];
  let newTargetActive: number;
  if (panelsToRestore.includes(activePanel)) {
    newTargetActive = 0;
  } else {
    newTargetActive = remainingPanels.indexOf(activePanel);
    if (newTargetActive < 0) newTargetActive = 0;
  }

  let newTree = replaceNode(tree, targetGroup.id, {
    ...targetGroup,
    panels: remainingPanels,
    activeIndex: newTargetActive,
  });

  // Recreate the tab group
  const restoredGroup: TabGroupNode = {
    type: 'tabgroup',
    id: record.removedGroupId,
    panels: panelsToRestore,
    activeIndex: Math.min(
      record.originalActiveIndex,
      panelsToRestore.length - 1
    ),
  };

  // Re-insert into parent split
  const currentParent = findNode(newTree, record.parentSplitId) as SplitNode;
  if (!currentParent || currentParent.type !== 'split') return null;

  const newChildren = [...currentParent.children];
  const newSizes = [...currentParent.sizes];

  // Scale existing sizes to make room
  const scaleFactor = 1 - record.originalSize;
  for (let i = 0; i < newSizes.length; i++) {
    newSizes[i] *= scaleFactor;
  }

  const insertIdx = Math.min(record.originalIndex, newChildren.length);
  newChildren.splice(insertIdx, 0, restoredGroup);
  newSizes.splice(insertIdx, 0, record.originalSize);

  newTree = replaceNode(newTree, record.parentSplitId, {
    ...currentParent,
    children: newChildren,
    sizes: newSizes,
  });

  return newTree;
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
    targetGroupId: string,
    insertIndex?: number
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

  const isDropTarget = dropZone && dropZone.targetId === node.id;

  const computeTabInsertIndex = useCallback(
    (e: React.DragEvent): number => {
      if (!tabBarRef.current) return 0;
      // Query non-dragging tabs so index is relative to the final list
      const tabs = tabBarRef.current.querySelectorAll(
        '.ide-tab:not(.ide-tab--dragging)'
      );
      for (let i = 0; i < tabs.length; i++) {
        const rect = tabs[i].getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (e.clientX < midX) return i;
      }
      return tabs.length;
    },
    []
  );

  const detectDropZone = useCallback(
    (e: React.DragEvent): { type: DropZoneType; insertIndex?: number } | null => {
      if (!containerRef.current || !tabBarRef.current) return null;

      const tabBarRect = tabBarRef.current.getBoundingClientRect();
      if (e.clientY < tabBarRect.bottom) {
        return { type: 'tab', insertIndex: computeTabInsertIndex(e) };
      }

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const threshold = 0.25;

      if (x < threshold) return { type: 'left' };
      if (x > 1 - threshold) return { type: 'right' };
      if (y < threshold) return { type: 'top' };
      if (y > 1 - threshold) return { type: 'bottom' };
      return { type: 'tab', insertIndex: computeTabInsertIndex(e) };
    },
    [computeTabInsertIndex]
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
        setDropZone({
          targetId: node.id,
          type: zone.type,
          insertIndex: zone.insertIndex,
        });
      }
    },
    [dragState, node.id, node.panels.length, detectDropZone, setDropZone]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
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
        movePanelToTabGroup(
          panelId,
          sourceGroupId,
          node.id,
          dropZone.insertIndex
        );
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

  // Build tab elements with insertion indicator
  const showInsert =
    isDropTarget &&
    dropZone!.type === 'tab' &&
    dropZone!.insertIndex !== undefined;
  const insertAt = dropZone?.insertIndex ?? -1;

  const tabElements: React.ReactNode[] = [];
  let nonDragIdx = 0;

  for (let i = 0; i < node.panels.length; i++) {
    const panelId = node.panels[i];
    const isDragging = dragState?.panelId === panelId;

    if (!isDragging) {
      if (showInsert && insertAt === nonDragIdx) {
        tabElements.push(
          <div key="insert-indicator" className="ide-tab-insert-indicator" />
        );
      }
      nonDragIdx++;
    }

    const panel = panelRegistry.get(panelId);
    if (!panel) continue;

    tabElements.push(
      <div
        key={panelId}
        className={`ide-tab${i === node.activeIndex ? ' ide-tab--active' : ''}${isDragging ? ' ide-tab--dragging' : ''}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', panelId);
          e.dataTransfer.effectAllowed = 'move';
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
  }

  // Indicator at end
  if (showInsert && insertAt === nonDragIdx) {
    tabElements.push(
      <div key="insert-indicator" className="ide-tab-insert-indicator" />
    );
  }

  return (
    <div
      ref={containerRef}
      className="ide-tabgroup"
      data-group-id={node.id}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div ref={tabBarRef} className="ide-tabbar">
        {tabElements}
      </div>

      {node.panels.map((panelId, i) => {
        const panel = panelRegistry.get(panelId);
        if (!panel) return null;
        return (
          <div
            key={panelId}
            className="ide-panel-content"
            style={i !== node.activeIndex ? { display: 'none' } : undefined}
          >
            {panel.render()}
          </div>
        );
      })}

      {isDropTarget && dropZone!.type !== 'tab' && (
        <DropIndicator type={dropZone!.type} />
      )}
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

export interface IDELayoutHandle {
  addPanelToLargestGroup: (panelId: string) => void;
}

export interface IDELayoutProps {
  panels: PanelDefinition[];
  initialLayout: LayoutNode;
  minPanelSize?: number;
}

const IDELayout = forwardRef<IDELayoutHandle, IDELayoutProps>(({
  panels,
  initialLayout,
  minPanelSize = 0.05,
}, ref) => {
  const [layout, setLayout] = useState<LayoutNode>(initialLayout);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const collapseStackRef = useRef<CollapseRecord[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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
    (
      panelId: string,
      sourceGroupId: string,
      targetGroupId: string,
      insertIndex?: number
    ) => {
      if (sourceGroupId === targetGroupId) {
        // Same-group reorder — preserve collapse stack
        setLayout((prev) => {
          const group = findNode(prev, sourceGroupId);
          if (!group || group.type !== 'tabgroup') return prev;

          const currentIdx = group.panels.indexOf(panelId);
          if (currentIdx === -1) return prev;

          const newPanels = group.panels.filter((p) => p !== panelId);
          const idx =
            insertIndex !== undefined
              ? Math.min(insertIndex, newPanels.length)
              : newPanels.length;
          newPanels.splice(idx, 0, panelId);

          return replaceNode(prev, sourceGroupId, {
            ...group,
            panels: newPanels,
            activeIndex: idx,
          });
        });
        return;
      }

      // Cross-group move — clear collapse stack
      collapseStackRef.current = [];
      setLayout((prev) => {
        // Remove from source
        let tree = removePanelFromNode(prev, sourceGroupId, panelId);

        // Add to target at specific position
        const target = findNode(tree, targetGroupId);
        if (!target || target.type !== 'tabgroup') return prev;

        const newPanels = [...target.panels];
        const idx =
          insertIndex !== undefined
            ? Math.min(insertIndex, newPanels.length)
            : newPanels.length;
        newPanels.splice(idx, 0, panelId);

        tree = replaceNode(tree, targetGroupId, {
          ...target,
          panels: newPanels,
          activeIndex: idx,
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
      collapseStackRef.current = [];
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
      collapseStackRef.current = [];
      setLayout((prev) => {
        const tree = removePanelFromNode(prev, groupId, panelId);
        return normalizeTree(tree) || prev;
      });
    },
    []
  );

  // ─── Responsive Collapse / Restore ──────────────────────────────────────────

  const handleResize = useCallback((width: number, height: number) => {
    setLayout((prev) => {
      let tree = prev;
      const stack = collapseStackRef.current;

      // Phase 1: Restore — if screen grew past the collapse point
      let didChange = true;
      while (didChange && stack.length > 0) {
        didChange = false;
        const record = stack[stack.length - 1];
        const dim =
          record.direction === 'horizontal' ? width : height;

        if (dim > record.collapsedAtDim + RESTORE_HYSTERESIS_PX) {
          const result = tryRestoreRecord(tree, record);
          if (result) {
            tree = result;
            stack.pop();
            didChange = true;
          } else {
            // Record is stale (user reorganized), discard it
            stack.pop();
            didChange = true;
          }
        }
      }

      // Phase 2: Collapse — find anything too small
      let collapsed = true;
      while (collapsed) {
        collapsed = false;
        const target = findSmallestBelowThreshold(
          tree,
          width,
          height
        );
        if (target && target.parentSplit.children.length > 1) {
          const result = performSingleCollapse(
            tree,
            target,
            width,
            height
          );
          if (result) {
            tree = result.tree;
            if (
              !stack.some(
                (r) => r.removedGroupId === result.record.removedGroupId
              )
            ) {
              stack.push(result.record);
            }
            collapsed = true;
          }
        }
      }

      return tree;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number;
    let prevWidth = 0;
    let prevHeight = 0;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;

      if (
        Math.abs(width - prevWidth) < 1 &&
        Math.abs(height - prevHeight) < 1
      )
        return;
      prevWidth = width;
      prevHeight = height;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        handleResize(width, height);
      });
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [handleResize]);

  // ─── Imperative API ──────────────────────────────────────────────────────────

  const addPanelToLargestGroup = useCallback((panelId: string) => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const tabGroupEls = containerEl.querySelectorAll('.ide-tabgroup[data-group-id]');
    let widestId = '';
    let widestWidth = 0;

    tabGroupEls.forEach(el => {
      const groupId = el.getAttribute('data-group-id');
      if (!groupId) return;
      const width = el.getBoundingClientRect().width;
      if (width > widestWidth) {
        widestWidth = width;
        widestId = groupId;
      }
    });

    if (!widestId) return;

    setLayout(prev => {
      const existing = findPanelInLayout(prev, panelId);
      if (existing) {
        const group = findNode(prev, existing.groupId);
        if (group && group.type === 'tabgroup') {
          return replaceNode(prev, existing.groupId, { ...group, activeIndex: existing.index });
        }
        return prev;
      }

      const group = findNode(prev, widestId);
      if (!group || group.type !== 'tabgroup') return prev;

      return replaceNode(prev, widestId, {
        ...group,
        panels: [panelId, ...group.panels],
        activeIndex: 0,
      });
    });
  }, []);

  useImperativeHandle(ref, () => ({
    addPanelToLargestGroup,
  }), [addPanelToLargestGroup]);

  // ────────────────────────────────────────────────────────────────────────────

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
      <div ref={containerRef} className="ide-layout">
        <LayoutNodeRenderer node={layout} />
      </div>
    </IDELayoutContext.Provider>
  );
});

export default IDELayout;
