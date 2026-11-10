---
feature: job-retry
---

# Retry a failed job

## Problem

A job ends at success or failure, and a failure stays failure. The need is to try that job again without dropping those two outcomes.

## Desired outcome

A failed job is retried automatically, up to 3 attempts including the first. The operator can see the job return to pending and which attempt is running. The third failure stays failure.

## User stories

- As an operator, when a job fails and attempts remain, I see it return to pending and the attempt number advance.
- As an operator, when attempt 3 fails, I see the job stay failure.
- As an operator, when an attempt succeeds, I see success and no further retry.

## Decisions

### Product

- A failed job is retried automatically. A person does not start each attempt.
- A job may run at most 3 attempts, including the first run.
- Success ends the job. It is not retried.
- The third failure stays failure. It is not retried.

### UX/UI

- While a retry is in progress, the operator sees the status and the words "attempt n of 3".
- A failure with attempts remaining shows the job back on pending, with the next attempt number.
- That path was driven in `retry-feel.html`. The file is evidence of the behavior. It is not the implementation, and it does not own this decision.

### Domain/data

- The status set stays pending, success, and failure. Retry is not a new status.
- The attempt count lives on the job and starts at 1.

## Acceptance / success

- A pending job that succeeds on attempt 1 ends as success and is not retried.
- A job that fails before attempt 3 returns to pending, and the attempt count increases by one.
- A job that fails on attempt 3 stays failure.
- A job already at success or failure is not started again.

## Evidence and references

- `src/job.ts` — `finish` moves a pending job to success or failure and returns any other job unchanged. The file has no retry.
- `src/job.test.ts` — two tests lock that current behavior.
- `retry-feel.html` — one driven failure showed pending at attempt 2 of 3. Failures through the limit showed failure at attempt 3 of 3. The page says it does not decide the product. Accepted here as what the operator must be able to see.

## Out of scope

- A person-started retry as the only path.
- Unlimited attempts.
- A separate status for retrying or for giving up.
- Backoff, queues, persistence, and remote HTTP retry.
