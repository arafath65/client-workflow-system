"use client";

import { useEffect, useState } from "react";

import EditWorkflowStepButton from "./EditWorkflowStepButton";
import WorkflowStepStatusButton from "./WorkflowStepStatusButton";
import AddWorkflowSubTaskButton from "./AddWorkflowSubTaskButton";
import DeleteWorkflowSubTaskButton from "./DeleteWorkflowSubTaskButton";

type Staff = {
  id: number;
  name: string;
};

type SubTask = {
  id: number;
  subTaskNumber: number;
  title: string;
  description: string | null;
  status: boolean;
};

type WorkflowStep = {
  id: number;
  stepNumber: number;
  title: string;
  defaultStaffId: number | null;
  status: boolean;
  defaultStaff: {
    id: number;
    name: string;
    status: boolean;
  } | null;
  subTasks: SubTask[];
};

type WorkflowStepsProps = {
  steps: WorkflowStep[];
  staff: Staff[];
};

export default function WorkflowSteps({
  steps: initialSteps,
  staff,
}: WorkflowStepsProps) {
  const [steps, setSteps] = useState(initialSteps);
  const [draggedId, setDraggedId] = useState<number | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
  setSteps(initialSteps);
}, [initialSteps]);

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    stepId: number
  ) => {
    setDraggedId(stepId);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      String(stepId)
    );
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetId: number
  ) => {
    e.preventDefault();

    const sourceId = Number(
      e.dataTransfer.getData("text/plain")
    );

    setDraggedId(null);

    if (!sourceId || sourceId === targetId) {
      return;
    }

    const oldSteps = [...steps];

    const sourceIndex = steps.findIndex(
      (step) => step.id === sourceId
    );

    const targetIndex = steps.findIndex(
      (step) => step.id === targetId
    );

    if (
      sourceIndex === -1 ||
      targetIndex === -1
    ) {
      return;
    }

    const reorderedSteps = [...steps];

    const [movedStep] = reorderedSteps.splice(
      sourceIndex,
      1
    );

    reorderedSteps.splice(
      targetIndex,
      0,
      movedStep
    );

    const numberedSteps = reorderedSteps.map(
      (step, index) => ({
        ...step,
        stepNumber: index + 1,
      })
    );

    setSteps(numberedSteps);

    try {
      setSaving(true);

      const response = await fetch(
        "/api/workflows/steps/reorder",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            steps: numberedSteps.map((step) => ({
              id: step.id,
              stepNumber: step.stepNumber,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setSteps(oldSteps);

        window.alert(
          data?.message ||
            "Unable to save workflow step order."
        );

        return;
      }
    } catch (error) {
      console.error(
        "Reorder workflow steps error:",
        error
      );

      setSteps(oldSteps);

      window.alert(
        "Something went wrong while saving the order."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  if (steps.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
            <span className="text-lg text-black/30">
              +
            </span>
          </div>

          <p className="mt-4 text-sm font-medium text-black/50">
            No workflow steps found
          </p>

          <p className="mt-1 text-xs text-black/30">
            Add a workflow step to build this workflow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Saving indicator */}
      {saving && (
        <div className="absolute right-5 top-3 z-10 rounded-full bg-black px-3 py-1.5 text-[10px] font-medium text-white shadow-sm">
          Saving order...
        </div>
      )}

      {steps.map((step) => (
        <div
          key={step.id}
          draggable
          onDragStart={(e) =>
            handleDragStart(e, step.id)
          }
          onDragOver={handleDragOver}
          onDrop={(e) =>
            handleDrop(e, step.id)
          }
          onDragEnd={handleDragEnd}
          className={`border-b border-black/10 px-5 py-5 transition last:border-b-0 ${
            draggedId === step.id
              ? "opacity-40"
              : "opacity-100"
          } ${
            !step.status
              ? "bg-black/[0.015]"
              : "bg-white"
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <div
              className="mt-1 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-black/20 transition hover:bg-black/[0.04] hover:text-black/50 active:cursor-grabbing"
              title="Drag to reorder"
            >
              <span className="text-sm tracking-[-2px]">
                ⋮⋮
              </span>
            </div>

            {/* Step Number */}
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                step.status
                  ? "bg-black text-[#f9a800]"
                  : "bg-black/10 text-black/40"
              }`}
            >
              {step.stepNumber}
            </div>

            {/* Step Content */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {step.title}
                    </h3>

                    {!step.status && (
                      <span className="rounded-full bg-black/[0.05] px-2 py-1 text-[9px] font-medium text-black/40">
                        Inactive
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-black/40">
                    Default Staff:{" "}
                    {step.defaultStaff?.name ||
                      "Not assigned"}
                  </p>
                </div>

                {/* Step Actions */}
                <div className="flex items-center gap-4">
                  <EditWorkflowStepButton
                    step={{
                      id: step.id,
                      title: step.title,
                      defaultStaffId:
                        step.defaultStaffId,
                    }}
                    staff={staff}
                  />

                  <WorkflowStepStatusButton
                    stepId={step.id}
                    active={step.status}
                  />
                </div>
              </div>

              {/* Sub Tasks */}
              {step.subTasks.length > 0 && (
                <div className="mt-4 ml-1 border-l-2 border-black/5 pl-4">
                  <div className="space-y-2">
                    {step.subTasks.map(
                      (subTask, subIndex) => (
                        <div
                          key={subTask.id}
                          className="flex items-center justify-between rounded-lg bg-[#fafaf9] px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="text-[10px] font-medium text-black/30">
                              {subIndex + 1}
                            </span>

                            <div className="min-w-0">
                              <p className="truncate text-xs text-black/65">
                                {subTask.title}
                              </p>

                              {subTask.description && (
                                <p className="mt-0.5 truncate text-[10px] text-black/35">
                                  {subTask.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Sub Task Actions */}
                          <div className="flex shrink-0 items-center gap-4">
                            <button
                              type="button"
                              className="text-[10px] font-medium text-black/35 transition hover:text-black"
                            >
                              Edit
                            </button>

                            <DeleteWorkflowSubTaskButton
                              subTaskId={subTask.id}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Add Sub Task */}
              {step.status && (
                <AddWorkflowSubTaskButton
                  workflowStepId={step.id}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}