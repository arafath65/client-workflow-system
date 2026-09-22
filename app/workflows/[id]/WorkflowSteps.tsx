"use client";

import { useEffect, useState } from "react";

import EditWorkflowStepButton from "./EditWorkflowStepButton";
import WorkflowStepStatusButton from "./WorkflowStepStatusButton";
import AddWorkflowSubTaskButton from "./AddWorkflowSubTaskButton";
import DeleteWorkflowSubTaskButton from "./DeleteWorkflowSubTaskButton";
import EditWorkflowSubTaskButton from "./EditWorkflowSubTaskButton";

type Staff = {
  id: number;
  name: string;
};

type SubTask = {
  id: number;
  subTaskNumber: number;
  title: string;
  description: string | null;
  defaultStaffId: number | null;
  defaultStaff: {
    id: number;
    name: string;
    status: boolean;
  } | null;
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

  const [draggedStepId, setDraggedStepId] =
    useState<number | null>(null);

  const [draggedSubTaskId, setDraggedSubTaskId] =
    useState<number | null>(null);

  const [savingStepOrder, setSavingStepOrder] =
    useState(false);

  const [savingSubTaskOrder, setSavingSubTaskOrder] =
    useState(false);

  /*
   * Keep local state synchronized with the
   * server-rendered data after router.refresh().
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSteps(initialSteps);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialSteps]);

  /* =========================================================
     WORKFLOW STEP REORDER
     ========================================================= */

  const handleStepDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    stepId: number
  ) => {
    setDraggedStepId(stepId);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      String(stepId)
    );
  };

  const handleStepDragOver = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleStepDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetId: number
  ) => {
    e.preventDefault();

    const sourceId = Number(
      e.dataTransfer.getData("text/plain")
    );

    setDraggedStepId(null);

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
      setSavingStepOrder(true);

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
      setSavingStepOrder(false);
    }
  };

  const handleStepDragEnd = () => {
    setDraggedStepId(null);
  };

  /* =========================================================
     SUB TASK REORDER
     ========================================================= */

  const handleSubTaskDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    subTaskId: number
  ) => {
    setDraggedSubTaskId(subTaskId);

    e.stopPropagation();

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      String(subTaskId)
    );
  };

  const handleSubTaskDragOver = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    e.dataTransfer.dropEffect = "move";
  };

  const handleSubTaskDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    workflowStepId: number,
    targetSubTaskId: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceSubTaskId = Number(
      e.dataTransfer.getData("text/plain")
    );

    setDraggedSubTaskId(null);

    if (
      !sourceSubTaskId ||
      sourceSubTaskId === targetSubTaskId
    ) {
      return;
    }

    const currentStepIndex = steps.findIndex(
      (step) => step.id === workflowStepId
    );

    if (currentStepIndex === -1) {
      return;
    }

    const currentStep = steps[currentStepIndex];

    const sourceIndex =
      currentStep.subTasks.findIndex(
        (subTask) =>
          subTask.id === sourceSubTaskId
      );

    const targetIndex =
      currentStep.subTasks.findIndex(
        (subTask) =>
          subTask.id === targetSubTaskId
      );

    if (
      sourceIndex === -1 ||
      targetIndex === -1
    ) {
      return;
    }

    const oldSteps = [...steps];

    const reorderedSubTasks = [
      ...currentStep.subTasks,
    ];

    const [movedSubTask] =
      reorderedSubTasks.splice(
        sourceIndex,
        1
      );

    reorderedSubTasks.splice(
      targetIndex,
      0,
      movedSubTask
    );

    const numberedSubTasks =
      reorderedSubTasks.map(
        (subTask, index) => ({
          ...subTask,
          subTaskNumber: index + 1,
        })
      );

    const updatedSteps = [...steps];

    updatedSteps[currentStepIndex] = {
      ...currentStep,
      subTasks: numberedSubTasks,
    };

    setSteps(updatedSteps);

    try {
      setSavingSubTaskOrder(true);

      const response = await fetch(
        "/api/workflows/subtasks/reorder",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            steps: numberedSubTasks.map(
              (subTask) => ({
                id: subTask.id,
                subTaskNumber:
                  subTask.subTaskNumber,
              })
            ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setSteps(oldSteps);

        window.alert(
          data?.message ||
            "Unable to save sub task order."
        );

        return;
      }
    } catch (error) {
      console.error(
        "Reorder sub tasks error:",
        error
      );

      setSteps(oldSteps);

      window.alert(
        "Something went wrong while saving the sub task order."
      );
    } finally {
      setSavingSubTaskOrder(false);
    }
  };

  const handleSubTaskDragEnd = () => {
    setDraggedSubTaskId(null);
  };

  /* =========================================================
     EMPTY STATE
     ========================================================= */

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

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="relative">
      {/* Saving indicators */}

      {savingStepOrder && (
        <div className="absolute right-5 top-3 z-20 rounded-full bg-black px-3 py-1.5 text-[10px] font-medium text-white shadow-sm">
          Saving step order...
        </div>
      )}

      {savingSubTaskOrder && (
        <div className="absolute right-5 top-3 z-20 rounded-full bg-black px-3 py-1.5 text-[10px] font-medium text-white shadow-sm">
          Saving sub task order...
        </div>
      )}

      {steps.map((step) => (
        <div
          key={step.id}
          draggable
          onDragStart={(e) =>
            handleStepDragStart(e, step.id)
          }
          onDragOver={handleStepDragOver}
          onDrop={(e) =>
            handleStepDrop(e, step.id)
          }
          onDragEnd={handleStepDragEnd}
          className={`border-b border-black/10 px-5 py-5 transition last:border-b-0 ${
            draggedStepId === step.id
              ? "opacity-40"
              : "opacity-100"
          } ${
            !step.status
              ? "bg-black/[0.015]"
              : "bg-white"
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Step Drag Handle */}

            <div
              className="mt-1 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-black/20 transition hover:bg-black/[0.04] hover:text-black/50 active:cursor-grabbing"
              title="Drag to reorder workflow steps"
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
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

              {/* =================================================
                  SUB TASKS
                  ================================================= */}

              {step.subTasks.length > 0 && (
                <div className="mt-4 ml-1 border-l-2 border-black/5 pl-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-black/30">
                      Sub Tasks
                    </p>

                    <p className="text-[9px] text-black/25">
                      Drag to reorder
                    </p>
                  </div>

                  <div className="space-y-2">
                    {step.subTasks.map(
                      (subTask) => (
                        <div
                          key={subTask.id}
                          draggable
                          onDragStart={(e) =>
                            handleSubTaskDragStart(
                              e,
                              subTask.id
                            )
                          }
                          onDragOver={
                            handleSubTaskDragOver
                          }
                          onDrop={(e) =>
                            handleSubTaskDrop(
                              e,
                              step.id,
                              subTask.id
                            )
                          }
                          onDragEnd={
                            handleSubTaskDragEnd
                          }
                          className={`flex items-center justify-between rounded-lg bg-[#fafaf9] px-3 py-2.5 transition ${
                            draggedSubTaskId ===
                            subTask.id
                              ? "opacity-40"
                              : "opacity-100"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {/* Sub Task Drag Handle */}

                            <div
                              className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-black/20 transition hover:bg-black/[0.04] hover:text-black/50 active:cursor-grabbing"
                              title="Drag to reorder sub tasks"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <span className="text-xs tracking-[-2px]">
                                ⋮⋮
                              </span>
                            </div>

                            {/* Sub Task Number */}

                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-[10px] font-medium text-black/40">
                              {subTask.subTaskNumber}
                            </span>

                            {/* Sub Task Details */}

                            <div className="min-w-0">
                              <p className="truncate text-xs text-black/65">
                                {subTask.title}
                              </p>

                              {subTask.description && (
                                <p className="mt-0.5 truncate text-[10px] text-black/35">
                                  {subTask.description}
                                </p>
                              )}

                              <p className="mt-0.5 text-[10px] text-black/35">
                                Default Staff:{" "}
                                <span className="text-black/50">
                                  {subTask.defaultStaff?.name ||
                                    "Not assigned"}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Sub Task Actions */}

                          <div className="flex shrink-0 items-center gap-4">
                            <div
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <EditWorkflowSubTaskButton
                                subTaskId={subTask.id}
                                initialTitle={
                                  subTask.title
                                }
                                initialDescription={
                                  subTask.description
                                }
                                initialDefaultStaffId={
                                  subTask.defaultStaffId
                                }
                              />
                            </div>

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