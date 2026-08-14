/**
 * Lista simples reordenável por arraste — para blocos que não têm itens dentro
 * (hoje: as seções do Roteiro do projeto).
 *
 * Quando o bloco tem itens aninhados e é preciso arrastar item entre blocos, o
 * caso é mais complexo e tem componente próprio (ver CronogramaProjetoEditor e
 * EcGrupos). Aqui a alça é entregue ao filho por render-prop, para que cada tela
 * decida onde encaixá-la no seu cabeçalho.
 */
import type { ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IcGrip } from "@/components/icons";
import { cx } from "@/lib/format";

export function ListaArrastavel({
  ids,
  onReordenar,
  children,
  className,
}: {
  ids: string[];
  onReordenar: (ids: string[]) => void;
  children: ReactNode;
  className?: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = ids.indexOf(String(e.active.id));
    const para = ids.indexOf(String(e.over.id));
    if (de < 0 || para < 0) return;
    onReordenar(arrayMove(ids, de, para));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
}

export function ItemArrastavel({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  /** Recebe a alça de arraste pronta — posicione-a onde fizer sentido no bloco. */
  children: (alca: ReactNode) => ReactNode;
}) {
  const sortable = useSortable({ id });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };

  const alca = (
    <button
      ref={sortable.setActivatorNodeRef}
      {...sortable.listeners}
      {...sortable.attributes}
      type="button"
      className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 touch-none"
      title="Arraste para reordenar"
      aria-label="Arrastar para reordenar"
    >
      <IcGrip width={18} height={18} />
    </button>
  );

  return (
    <div ref={sortable.setNodeRef} style={style} className={cx(className, sortable.isDragging && "opacity-40")}>
      {children(alca)}
    </div>
  );
}
