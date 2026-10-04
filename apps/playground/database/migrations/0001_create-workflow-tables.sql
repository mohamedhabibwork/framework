CREATE TABLE "workflow_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"path" text NOT NULL,
	"node_index" integer DEFAULT 0 NOT NULL,
	"group_id" text,
	"via" text DEFAULT 'inline' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"output" jsonb,
	"error" text,
	"wait_event" text,
	"wait_deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow" text NOT NULL,
	"version" integer NOT NULL,
	"input" jsonb NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"actor" jsonb,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_parent_id_workflow_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_nodes_run_parent_idx" ON "workflow_nodes" USING btree ("run_id","parent_id","node_index");--> statement-breakpoint
CREATE INDEX "workflow_nodes_run_status_idx" ON "workflow_nodes" USING btree ("run_id","status");--> statement-breakpoint
CREATE INDEX "workflow_nodes_wait_idx" ON "workflow_nodes" USING btree ("wait_event","status");--> statement-breakpoint
CREATE INDEX "workflow_runs_workflow_created_idx" ON "workflow_runs" USING btree ("workflow","created_at");--> statement-breakpoint
CREATE INDEX "workflow_runs_status_created_idx" ON "workflow_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "workflow_runs_correlation_idx" ON "workflow_runs" USING btree ("correlation_id");