type ClientFileProgressProps = {
  completed: number;
  total: number;
  fileStatus: string;
};

export default function ClientFileProgress({
  completed,
  total,
  fileStatus,
}: ClientFileProgressProps) {
  const percentage =
    total > 0
      ? Math.round((completed / total) * 100)
      : 0;

  const isCompleted =
    fileStatus === "COMPLETED";

  return (
    <div className="min-w-[180px]">
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${
              isCompleted
                ? "bg-green-500"
                : "bg-[#f9a800]"
            }`}
            style={{
              width: `${percentage}%`,
            }}
          />
        </div>

        <span className="w-10 text-right text-xs font-semibold text-black/65">
          {percentage}%
        </span>
      </div>

      <p className="mt-2 text-[10px] text-black/40">
        {completed} of {total} completed
      </p>
    </div>
  );
}