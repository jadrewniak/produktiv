export type JobStatus = "pending" | "success" | "failure";

export type Job = {
  id: string;
  status: JobStatus;
};

export function finish(job: Job, outcome: "success" | "failure"): Job {
  if (job.status !== "pending") {
    return job;
  }
  return { id: job.id, status: outcome };
}
