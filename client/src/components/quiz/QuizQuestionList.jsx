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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRef } from 'react';
import QuizQuestionCard from './QuizQuestionCard';

function SortableQuestionCard({
  item,
  index,
  bankQuestions,
  onChange,
  onDuplicate,
  onDelete,
  setCardRef,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.localKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <QuizQuestionCard
        ref={setCardRef}
        item={item}
        index={index}
        bankQuestions={bankQuestions}
        onChange={onChange}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

export default function QuizQuestionList({
  items,
  bankQuestions,
  onReorder,
  onChangeItem,
  onDuplicateItem,
  onDeleteItem,
  cardRefs,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.localKey === active.id);
    const newIndex = items.findIndex((item) => item.localKey === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  const localCardRefs = useRef({});
  const refs = cardRefs || localCardRefs;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.localKey)} strategy={verticalListSortingStrategy}>
        <div className="ba-quiz-question-list">
          {items.map((item, index) => (
            <SortableQuestionCard
              key={item.localKey}
              item={item}
              index={index}
              bankQuestions={bankQuestions}
              setCardRef={(el) => {
                if (el) refs.current[item.localKey] = el;
                else delete refs.current[item.localKey];
              }}
              onChange={(next) => onChangeItem(index, next)}
              onDuplicate={() => onDuplicateItem(index)}
              onDelete={() => onDeleteItem(index)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
