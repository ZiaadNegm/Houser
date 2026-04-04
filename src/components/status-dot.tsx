export function StatusDot({ status }: { status: string }) {
  const color =
    status === "success"
      ? "bg-green-500"
      : status === "failed"
        ? "bg-red-500"
        : "bg-yellow-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}
