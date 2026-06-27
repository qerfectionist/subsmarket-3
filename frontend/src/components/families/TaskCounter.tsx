export function TaskCounter({ value }: { value: number }) {
  return (
    <span className="task-counter" aria-label={`Количество: ${value}`}>
      {value}
    </span>
  );
}