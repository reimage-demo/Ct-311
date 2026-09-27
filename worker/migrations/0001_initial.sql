PRAGMA foreign_keys = ON;
CREATE TABLE sessions (tokenHash TEXT PRIMARY KEY, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, uploadCount INTEGER NOT NULL DEFAULT 0, reportId TEXT);
CREATE INDEX sessions_expiry ON sessions(expiresAt);
CREATE TABLE staff (_id TEXT PRIMARY KEY, subject TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('staff','admin')), active INTEGER NOT NULL CHECK(active IN (0,1)), version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE reports (_id TEXT PRIMARY KEY, sessionHash TEXT NOT NULL UNIQUE, number TEXT NOT NULL UNIQUE, serviceId TEXT NOT NULL, description TEXT NOT NULL, address TEXT NOT NULL, landmark TEXT NOT NULL, latitude REAL, longitude REAL, locationMethod TEXT NOT NULL, locationNeedsReview INTEGER NOT NULL DEFAULT 1, locale TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('received','under_review','assigned','in_progress','needs_information','resolved','closed')), assignee TEXT REFERENCES staff(_id), createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1, lastActor TEXT NOT NULL, lastReason TEXT NOT NULL);
CREATE INDEX reports_created ON reports(createdAt DESC,_id DESC);
CREATE INDEX reports_status ON reports(status,createdAt DESC,_id DESC);
CREATE INDEX reports_service ON reports(serviceId,createdAt DESC,_id DESC);
CREATE INDEX reports_assignee ON reports(assignee,createdAt DESC,_id DESC);
CREATE TABLE contacts (reportId TEXT PRIMARY KEY REFERENCES reports(_id), name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, preferredContact TEXT NOT NULL);
CREATE TABLE attachments (_id TEXT PRIMARY KEY, sessionHash TEXT NOT NULL, slot TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('reserved','ready','deleting')), objectKey TEXT NOT NULL UNIQUE, reportId TEXT REFERENCES reports(_id), createdAt INTEGER NOT NULL, leaseUntil INTEGER NOT NULL, name TEXT NOT NULL, size INTEGER, UNIQUE(sessionHash,slot));
CREATE INDEX attachments_session ON attachments(sessionHash);
CREATE INDEX attachments_report ON attachments(reportId);
CREATE INDEX attachments_lease ON attachments(state,leaseUntil);
CREATE TABLE audit (_id TEXT PRIMARY KEY, reportId TEXT REFERENCES reports(_id), actor TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL, status TEXT, oldAssignee TEXT, newAssignee TEXT);
CREATE INDEX audit_report ON audit(reportId,at DESC,_id DESC);
CREATE INDEX audit_status ON audit(reportId,status,at);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AUDIT'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AUDIT'); END;
CREATE TRIGGER attachments_no_final_delete BEFORE DELETE ON attachments WHEN OLD.reportId IS NOT NULL BEGIN SELECT RAISE(ABORT,'FINALIZED_FILE'); END;
CREATE TRIGGER attachments_no_final_update BEFORE UPDATE ON attachments WHEN OLD.reportId IS NOT NULL BEGIN SELECT RAISE(ABORT,'FINALIZED_FILE'); END;
CREATE TRIGGER reserve_upload BEFORE INSERT ON attachments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions WHERE tokenHash=NEW.sessionHash AND reportId IS NULL AND expiresAt>NEW.createdAt AND uploadCount<24) THEN RAISE(ABORT,'UPLOAD_LIMIT') END;
 SELECT CASE WHEN (SELECT count(*) FROM attachments WHERE sessionHash=NEW.sessionHash)>=6 THEN RAISE(ABORT,'UPLOAD_LIMIT') END;
END;
CREATE TRIGGER count_upload AFTER INSERT ON attachments BEGIN UPDATE sessions SET uploadCount=uploadCount+1 WHERE tokenHash=NEW.sessionHash; END;
CREATE TRIGGER report_guard BEFORE INSERT ON reports BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions WHERE tokenHash=NEW.sessionHash AND reportId IS NULL AND expiresAt>NEW.createdAt) THEN RAISE(ABORT,'SESSION_EXPIRED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE sessionHash=NEW.sessionHash AND state!='ready') THEN RAISE(ABORT,'PHOTOS_PENDING') END;
END;
CREATE TRIGGER report_received AFTER INSERT ON reports BEGIN
 UPDATE sessions SET reportId=NEW._id WHERE tokenHash=NEW.sessionHash;
 UPDATE attachments SET reportId=NEW._id WHERE sessionHash=NEW.sessionHash;
 INSERT INTO audit VALUES(lower(hex(randomblob(16))),NEW._id,NEW.lastActor,'received',NEW.lastReason,NEW.createdAt,NEW.status,NULL,NULL);
END;
CREATE TRIGGER report_updated AFTER UPDATE ON reports BEGIN
 INSERT INTO audit VALUES(lower(hex(randomblob(16))),NEW._id,NEW.lastActor,'update',NEW.lastReason,NEW.updatedAt,CASE WHEN OLD.status!=NEW.status THEN NEW.status ELSE NULL END,OLD.assignee,NEW.assignee);
END;
CREATE VIRTUAL TABLE report_search USING fts5(reportId UNINDEXED, text, tokenize='unicode61');
CREATE TRIGGER search_insert AFTER INSERT ON contacts BEGIN
 INSERT INTO report_search(reportId,text) SELECT r._id,r.number||' '||r.address||' '||NEW.name||' '||NEW.email||' '||NEW.phone FROM reports r WHERE r._id=NEW.reportId;
END;
CREATE TABLE maintenance (key TEXT PRIMARY KEY, value TEXT NOT NULL);
ALTER TABLE staff ADD COLUMN lastActor TEXT NOT NULL DEFAULT 'Setup';
CREATE TRIGGER staff_added AFTER INSERT ON staff BEGIN
 INSERT INTO audit VALUES(lower(hex(randomblob(16))),NULL,NEW.lastActor,'membership',NEW.name||': '||NEW.role||'; active='||NEW.active,CAST(unixepoch('subsec')*1000 AS INTEGER),NULL,NULL,NULL);
END;
CREATE TRIGGER staff_updated AFTER UPDATE ON staff BEGIN
 INSERT INTO audit VALUES(lower(hex(randomblob(16))),NULL,NEW.lastActor,'membership',NEW.name||': '||NEW.role||'; active='||NEW.active,CAST(unixepoch('subsec')*1000 AS INTEGER),NULL,NULL,NULL);
END;

CREATE INDEX audit_public_history ON audit(reportId,at DESC,_id DESC) WHERE status IS NOT NULL;
CREATE INDEX attachments_pending ON attachments(state,leaseUntil) WHERE reportId IS NULL;
