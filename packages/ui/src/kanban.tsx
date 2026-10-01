"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragCancelEvent,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  KeyboardSensor,
  MeasuringStrategy,
  type Modifiers,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  type AnimateLayoutChanges,
  arrayMove,
  defaultAnimateLayoutChanges,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS, type Transform } from "@dnd-kit/utilities";
import { cn } from "@wryte/logic/lib/utils";
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

type Columns<T> = Record<string, T[]>;

type KanbanContextValue = {
  itemIds: Record<string, string[]>;
  activeId: UniqueIdentifier | null;
  isColumn: (id: UniqueIdentifier) => boolean;
  modifiers: Modifiers | undefined;
};

const KanbanContext = createContext<KanbanContextValue>({
  itemIds: {},
  activeId: null,
  isColumn: () => false,
  modifiers: undefined,
});

type HandleContextValue = {
  attributes: DraggableAttributes | undefined;
  listeners: DraggableSyntheticListeners | undefined;
  setActivatorNodeRef: ((element: HTMLElement | null) => void) | undefined;
  isDragging: boolean;
  disabled: boolean;
};

const OVERLAY_HANDLE: HandleContextValue = {
  attributes: undefined,
  listeners: undefined,
  setActivatorNodeRef: undefined,
  isDragging: true,
  disabled: false,
};

const ColumnContext = createContext<HandleContextValue>({
  ...OVERLAY_HANDLE,
  isDragging: false,
});

const ItemContext = createContext<HandleContextValue>({
  ...OVERLAY_HANDLE,
  isDragging: false,
});

const IsOverlayContext = createContext(false);

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.4",
      },
    },
  }),
};

const subscribeToNothing = () => () => {};
const getIsMounted = () => true;
const getIsMountedOnServer = () => false;

const MOUSE_SENSOR_OPTIONS = { activationConstraint: { distance: 10 } };
const TOUCH_SENSOR_OPTIONS = {
  activationConstraint: { delay: 250, tolerance: 5 },
};
const KEYBOARD_SENSOR_OPTIONS = {
  coordinateGetter: sortableKeyboardCoordinates,
};
const MEASURING_CONFIG = {
  droppable: { strategy: MeasuringStrategy.Always },
};

function sortableStyle(
  transform: Transform | null,
  transition: string | undefined,
): CSSProperties {
  const value = CSS.Transform.toString(transform);
  return {
    ...(value ? { transform: value } : {}),
    ...(transition ? { transition } : {}),
  };
}

function locate<T>(
  columns: Columns<T>,
  getId: (item: T) => string,
  id: string,
): { container: string; index: number } | undefined {
  for (const key of Object.keys(columns)) {
    const index = (columns[key] ?? []).findIndex((item) => getId(item) === id);
    if (index !== -1) return { container: key, index };
  }
  return undefined;
}

export type KanbanCommitMeta<T> = {
  kind: "item" | "column";
  event: DragEndEvent | DragCancelEvent;
  activeContainer: string;
  activeIndex: number;
  overContainer: string;
  overIndex: number;
  previousValue: Columns<T>;
};

export type KanbanRootProps<T> = Omit<
  useRender.ComponentProps<"div">,
  "children" | "onDragStart" | "onDragEnd"
> & {
  value: Columns<T>;
  onValueChange: (value: Columns<T>) => void;
  getItemValue: (item: T) => string;
  children: ReactNode;
  onValueCommit?: (value: Columns<T>, meta: KanbanCommitMeta<T>) => void;
  restoreOnCancel?: boolean;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: (event: DragCancelEvent) => void;
  accessibility?: ComponentProps<typeof DndContext>["accessibility"];
  modifiers?: Modifiers;
};

type DragOrigin<T> = {
  value: Columns<T>;
  container: string | undefined;
  index: number;
};

function Kanban<T>({
  value: columns,
  onValueChange: setColumns,
  getItemValue,
  children,
  className,
  render,
  onValueCommit,
  restoreOnCancel = false,
  onDragStart,
  onDragEnd,
  onDragCancel,
  accessibility,
  modifiers,
  ...props
}: KanbanRootProps<T>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const valueRef = useRef(columns);
  const getItemValueRef = useRef(getItemValue);
  useLayoutEffect(() => {
    valueRef.current = columns;
    getItemValueRef.current = getItemValue;
  });
  const dragOriginRef = useRef<DragOrigin<T> | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, MOUSE_SENSOR_OPTIONS),
    useSensor(TouchSensor, TOUCH_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  );

  const columnIds = useMemo(() => Object.keys(columns), [columns]);

  const itemIds = useMemo(() => {
    const ids: Record<string, string[]> = {};
    for (const key of columnIds) {
      ids[key] = (columns[key] ?? []).map(getItemValue);
    }
    return ids;
  }, [columns, columnIds, getItemValue]);

  const isColumn = useCallback(
    (id: UniqueIdentifier) => columnIds.includes(String(id)),
    [columnIds],
  );

  const findContainer = useCallback(
    (id: UniqueIdentifier) => {
      const key = String(id);
      if (isColumn(key)) return key;
      return columnIds.find((column) => itemIds[column]?.includes(key));
    },
    [columnIds, itemIds, isColumn],
  );

  const lastOverIdRef = useRef<UniqueIdentifier | null>(null);
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      if (isColumn(args.active.id)) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) =>
            isColumn(container.id),
          ),
        });
      }

      if (!args.pointerCoordinates) return rectIntersection(args);

      let overId = getFirstCollision(pointerWithin(args), "id");
      if (overId != null) {
        if (isColumn(overId)) {
          const ids = new Set(itemIds[String(overId)] ?? []);
          const items = args.droppableContainers.filter((container) =>
            ids.has(String(container.id)),
          );
          const bottom = Math.max(
            ...items.map(
              (container) =>
                args.droppableRects.get(container.id)?.bottom ??
                Number.NEGATIVE_INFINITY,
            ),
          );
          if (args.pointerCoordinates.y <= bottom) {
            overId =
              closestCenter({ ...args, droppableContainers: items })[0]?.id ??
              overId;
          }
        }
        lastOverIdRef.current = overId;
        return [{ id: overId }];
      }

      return lastOverIdRef.current != null
        ? [{ id: lastOverIdRef.current }]
        : rectIntersection(args);
    },
    [itemIds, isColumn],
  );

  const commitChange = useCallback(
    (
      finalValue: Columns<T>,
      event: DragEndEvent | DragCancelEvent,
      kind: "item" | "column",
    ) => {
      if (!onValueCommit) return;
      const origin = dragOriginRef.current;
      if (!origin) return;

      const id = String(event.active.id);

      if (kind === "column") {
        const overIndex = Object.keys(finalValue).indexOf(id);
        if (overIndex === -1 || overIndex === origin.index) return;
        onValueCommit(finalValue, {
          kind: "column",
          event,
          activeContainer: id,
          activeIndex: origin.index,
          overContainer: String(event.over?.id ?? id),
          overIndex,
          previousValue: origin.value,
        });
        return;
      }

      const found = locate(finalValue, getItemValueRef.current, id);
      if (!found) return;
      if (found.container === origin.container && found.index === origin.index)
        return;
      onValueCommit(finalValue, {
        kind: "item",
        event,
        activeContainer: origin.container ?? found.container,
        activeIndex: origin.index,
        overContainer: found.container,
        overIndex: found.index,
        previousValue: origin.value,
      });
    },
    [onValueCommit],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      lastOverIdRef.current = null;
      setActiveId(event.active.id);
      onDragStart?.(event);

      if (!onValueCommit && !restoreOnCancel) return;
      const snapshot = valueRef.current;
      const id = String(event.active.id);
      const keys = Object.keys(snapshot);
      if (keys.includes(id)) {
        dragOriginRef.current = {
          value: snapshot,
          container: id,
          index: keys.indexOf(id),
        };
        return;
      }
      const found = locate(snapshot, getItemValueRef.current, id);
      dragOriginRef.current = {
        value: snapshot,
        container: found?.container,
        index: found?.index ?? -1,
      };
    },
    [onDragStart, onValueCommit, restoreOnCancel],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || isColumn(active.id)) return;

      const activeContainer = findContainer(active.id);
      const overContainer = findContainer(over.id);
      if (!activeContainer || !overContainer) return;

      const activeItems = columns[activeContainer] ?? [];
      const activeIndex = activeItems.findIndex(
        (item) => getItemValue(item) === String(active.id),
      );

      if (activeContainer !== overContainer) {
        const overItems = columns[overContainer] ?? [];
        const overIndex = isColumn(over.id)
          ? overItems.length
          : overItems.findIndex(
              (item) => getItemValue(item) === String(over.id),
            );

        const nextActive = [...activeItems];
        const [moved] = nextActive.splice(activeIndex, 1);
        if (moved === undefined) return;
        const nextOver = [...overItems];
        nextOver.splice(
          overIndex === -1 ? overItems.length : overIndex,
          0,
          moved,
        );

        setColumns({
          ...columns,
          [activeContainer]: nextActive,
          [overContainer]: nextOver,
        });
        return;
      }

      const overIndex = isColumn(over.id)
        ? activeItems.length - 1
        : activeItems.findIndex(
            (item) => getItemValue(item) === String(over.id),
          );
      if (overIndex !== -1 && activeIndex !== overIndex) {
        setColumns({
          ...columns,
          [activeContainer]: arrayMove(activeItems, activeIndex, overIndex),
        });
      }
    },
    [findContainer, getItemValue, isColumn, setColumns, columns],
  );

  const handleDragCancel = useCallback(
    (event: DragCancelEvent) => {
      const origin = dragOriginRef.current;

      if (restoreOnCancel && origin) {
        setColumns(origin.value);
      } else if (onValueCommit && origin) {
        commitChange(valueRef.current, event, "item");
      }

      dragOriginRef.current = null;
      lastOverIdRef.current = null;
      setActiveId(null);
      onDragCancel?.(event);
    },
    [restoreOnCancel, onValueCommit, setColumns, onDragCancel, commitChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      lastOverIdRef.current = null;
      setActiveId(null);
      onDragEnd?.(event);

      if (!over) {
        commitChange(valueRef.current, event, "item");
        dragOriginRef.current = null;
        return;
      }

      if (isColumn(active.id)) {
        if (isColumn(over.id)) {
          const activeIndex = columnIds.indexOf(String(active.id));
          const overIndex = columnIds.indexOf(String(over.id));
          if (activeIndex !== overIndex) {
            const next: Columns<T> = {};
            for (const key of arrayMove(columnIds, activeIndex, overIndex)) {
              next[key] = columns[key] ?? [];
            }
            setColumns(next);
            commitChange(next, event, "column");
          }
        }
        dragOriginRef.current = null;
        return;
      }

      const activeContainer = findContainer(active.id);
      const overContainer = findContainer(over.id);

      if (activeContainer && activeContainer === overContainer) {
        const items = columns[activeContainer] ?? [];
        const activeIndex = items.findIndex(
          (item) => getItemValue(item) === String(active.id),
        );
        const overIndex = items.findIndex(
          (item) => getItemValue(item) === String(over.id),
        );

        if (overIndex !== -1 && activeIndex !== overIndex) {
          const next = {
            ...columns,
            [activeContainer]: arrayMove(items, activeIndex, overIndex),
          };
          setColumns(next);
          commitChange(next, event, "item");
        } else {
          commitChange(columns, event, "item");
        }
      } else {
        commitChange(columns, event, "item");
      }
      dragOriginRef.current = null;
    },
    [
      columnIds,
      columns,
      findContainer,
      getItemValue,
      isColumn,
      setColumns,
      onDragEnd,
      commitChange,
    ],
  );

  const contextValue = useMemo(
    () => ({ itemIds, activeId, isColumn, modifiers }),
    [itemIds, activeId, isColumn, modifiers],
  );

  const element = useRender({
    defaultTagName: "div",
    render,
    state: { slot: "kanban", dragging: activeId !== null },
    props: mergeProps<"div">(
      {
        className: cn(activeId !== null && "cursor-grabbing!", className),
        children,
      },
      props,
    ),
  });

  return (
    <KanbanContext value={contextValue}>
      <DndContext
        sensors={sensors}
        {...(modifiers ? { modifiers } : {})}
        {...(accessibility ? { accessibility } : {})}
        measuring={MEASURING_CONFIG}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {element}
      </DndContext>
    </KanbanContext>
  );
}

export type KanbanBoardProps = useRender.ComponentProps<"div">;

function KanbanBoard({ className, render, ...props }: KanbanBoardProps) {
  const { itemIds } = useContext(KanbanContext);
  const columnIds = useMemo(() => Object.keys(itemIds), [itemIds]);

  const element = useRender({
    defaultTagName: "div",
    render,
    state: { slot: "kanban-board" },
    props: mergeProps<"div">(
      {
        className: cn("grid auto-rows-fr gap-4 sm:grid-cols-3", className),
      },
      props,
    ),
  });

  return (
    <SortableContext items={columnIds} strategy={rectSortingStrategy}>
      {element}
    </SortableContext>
  );
}

export type KanbanColumnProps = useRender.ComponentProps<"div"> & {
  value: string;
  disabled?: boolean;
};

function KanbanColumn({
  value,
  className,
  render,
  disabled = false,
  ref,
  ...props
}: KanbanColumnProps) {
  const isOverlay = useContext(IsOverlayContext);
  const { activeId, isColumn } = useContext(KanbanContext);

  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    attributes,
    listeners,
    isDragging,
  } = useSortable({
    id: value,
    disabled: disabled || isOverlay,
    animateLayoutChanges,
  });

  const element = useRender({
    defaultTagName: "div",
    render,
    ref: isOverlay ? ref : ref ? [setNodeRef, ref] : setNodeRef,
    state: {
      slot: "kanban-column",
      value,
      dragging: isOverlay || isDragging,
      disabled: !isOverlay && disabled,
    },
    props: mergeProps<"div">(
      isOverlay
        ? { className: cn("group/kanban-column flex flex-col", className) }
        : {
            style: sortableStyle(transform, transition),
            className: cn(
              "group/kanban-column flex flex-col",
              isDragging && "z-50 opacity-50",
              disabled && "opacity-50",
              className,
            ),
          },
      props,
    ),
  });

  return (
    <ColumnContext
      value={
        isOverlay
          ? OVERLAY_HANDLE
          : {
              attributes,
              listeners,
              setActivatorNodeRef,
              isDragging: activeId ? isColumn(activeId) : false,
              disabled,
            }
      }
    >
      {element}
    </ColumnContext>
  );
}

export type KanbanHandleProps = useRender.ComponentProps<"div"> & {
  cursor?: boolean;
};

function useHandle(
  context: HandleContextValue,
  slot: string,
  { className, render, cursor = true, ref, ...props }: KanbanHandleProps,
  extraClassName?: string,
) {
  const { attributes, listeners, setActivatorNodeRef, isDragging, disabled } =
    context;
  return useRender({
    defaultTagName: "div",
    render,
    ref:
      setActivatorNodeRef && ref
        ? [setActivatorNodeRef, ref]
        : (setActivatorNodeRef ?? ref),
    state: { slot, dragging: isDragging, disabled },
    props: mergeProps<"div">(
      {
        ...attributes,
        ...listeners,
        className: cn(
          extraClassName,
          cursor && (isDragging ? "cursor-grabbing!" : "cursor-grab!"),
          className,
        ),
      },
      props,
    ),
  });
}

function KanbanColumnHandle(props: KanbanHandleProps) {
  return useHandle(
    useContext(ColumnContext),
    "kanban-column-handle",
    props,
    "opacity-0 transition-opacity group-hover/kanban-column:opacity-100",
  );
}

export type KanbanItemProps = useRender.ComponentProps<"div"> & {
  value: string;
  disabled?: boolean;
  asHandle?: boolean;
};

function KanbanItem({
  value,
  className,
  render,
  disabled = false,
  asHandle = false,
  ref,
  ...props
}: KanbanItemProps) {
  const isOverlay = useContext(IsOverlayContext);
  const { activeId, isColumn } = useContext(KanbanContext);

  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    attributes,
    listeners,
    isDragging,
  } = useSortable({
    id: value,
    disabled: disabled || isOverlay,
    animateLayoutChanges,
  });

  const nodeRefs = asHandle ? [setNodeRef, setActivatorNodeRef] : [setNodeRef];

  const element = useRender({
    defaultTagName: "div",
    render,
    ref: isOverlay ? ref : ref ? [...nodeRefs, ref] : nodeRefs,
    state: {
      slot: "kanban-item",
      value,
      dragging: isOverlay || isDragging,
      disabled: !isOverlay && disabled,
    },
    props: mergeProps<"div">(
      isOverlay
        ? { className }
        : {
            style: sortableStyle(transform, transition),
            ...attributes,
            ...(asHandle ? listeners : {}),
            className: cn(
              isDragging && "z-50 opacity-50",
              disabled && "opacity-50",
              className,
            ),
          },
      props,
    ),
  });

  return (
    <ItemContext
      value={
        isOverlay
          ? OVERLAY_HANDLE
          : {
              attributes: undefined,
              listeners,
              setActivatorNodeRef: asHandle ? undefined : setActivatorNodeRef,
              isDragging: activeId ? !isColumn(activeId) : false,
              disabled,
            }
      }
    >
      {element}
    </ItemContext>
  );
}

function KanbanItemHandle(props: KanbanHandleProps) {
  return useHandle(useContext(ItemContext), "kanban-item-handle", props);
}

export type KanbanColumnContentProps = useRender.ComponentProps<"div"> & {
  value: string;
};

function KanbanColumnContent({
  value,
  className,
  render,
  ...props
}: KanbanColumnContentProps) {
  const { itemIds } = useContext(KanbanContext);
  const ids = itemIds[value];
  if (!ids) {
    throw new Error(
      `KanbanColumnContent: column "${value}" was not found in the Kanban value.`,
    );
  }

  const element = useRender({
    defaultTagName: "div",
    render,
    state: { slot: "kanban-column-content" },
    props: mergeProps<"div">(
      {
        className: cn("flex flex-col gap-2", className),
      },
      props,
    ),
  });

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {element}
    </SortableContext>
  );
}

export type KanbanOverlayProps = Omit<
  ComponentProps<typeof DragOverlay>,
  "children"
> & {
  children?:
    | ReactNode
    | ((params: {
        value: UniqueIdentifier;
        variant: "column" | "item";
      }) => ReactNode);
};

function KanbanOverlay({ children, className, ...props }: KanbanOverlayProps) {
  const { activeId, isColumn, modifiers } = useContext(KanbanContext);
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getIsMounted,
    getIsMountedOnServer,
  );

  if (!mounted) return null;

  const variant = activeId !== null && isColumn(activeId) ? "column" : "item";
  const content =
    activeId !== null && children
      ? typeof children === "function"
        ? children({ value: activeId, variant })
        : children
      : null;

  return createPortal(
    <DragOverlay
      dropAnimation={dropAnimationConfig}
      {...(modifiers ? { modifiers } : {})}
      className={cn("z-50", activeId !== null && "cursor-grabbing", className)}
      {...props}
    >
      <IsOverlayContext value={true}>{content}</IsOverlayContext>
    </DragOverlay>,
    document.body,
  );
}

export {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
};
