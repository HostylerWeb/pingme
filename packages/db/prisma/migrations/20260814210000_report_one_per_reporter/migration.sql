-- Keep the earliest report per reporter/reported pair, remove duplicates.
DELETE FROM reports a
USING reports b
WHERE a.reporter_id = b.reporter_id
  AND a.reported_user_id = b.reported_user_id
  AND a.created_at > b.created_at;

-- One report per reporter against a given user.
CREATE UNIQUE INDEX "reports_reporter_id_reported_user_id_key" ON "reports"("reporter_id", "reported_user_id");
