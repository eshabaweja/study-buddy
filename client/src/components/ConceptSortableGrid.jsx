import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ConceptFlashcard from './ConceptFlashcard';

function SortableConceptCard({ concept }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: concept.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`app-concept-sortable${isDragging ? ' app-concept-sortable--dragging' : ''}`}
    >
      <button
        type="button"
        className="app-concept-sortable__drag-handle"
        aria-label={`Drag to reorder ${concept.name}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <ConceptFlashcard concept={concept} />
    </div>
  );
}

export default function ConceptSortableGrid({ concepts, onReorder, disabled = false }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = concepts.findIndex((c) => c.id === active.id);
    const newIndex = concepts.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(concepts, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={concepts.map((c) => c.id)} strategy={rectSortingStrategy}>
        <div className="app-grid-layout app-concept-sortable-grid">
          {concepts.map((concept) => (
            <SortableConceptCard key={concept.id} concept={concept} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
