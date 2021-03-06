﻿DROP TABLE IF EXISTS ${TABLE_PREFIX}aggregation CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}assessment CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}broker CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}brokerage CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}condition CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}contact CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}derivative CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}entity CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}feed CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}hardware CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}licence CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}organisation CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}position CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}provider CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}service CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}spatial CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}technology CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}timeseries CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}timeseries_aggregation CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}timeseries_assessment CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}timeseries_derivative CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}unit CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}storage CASCADE;

DROP TABLE IF EXISTS ${TABLE_PREFIX}data_bool CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}data_int CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}data_real CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}data_string CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}data_ts CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}data_event CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}data_file CASCADE;
DROP TABLE IF EXISTS ${TABLE_PREFIX}data_json CASCADE;

DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}feed::technology" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}feed::provider" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}feed::hardware" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}feed::entity" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}feed::brokerage" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}provider::organisation" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}service::feed" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}spatial::position_id" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}technology::organisation_id" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}timeseries::feed" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}brokerage::feed" CASCADE;
DROP INDEX IF EXISTS "IDX: ${TABLE_PREFIX}storage::storage_id" CASCADE;

CREATE TABLE ${TABLE_PREFIX}aggregation
(
  aggregation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(100),
  method character varying(10),
  "interval" integer,
  CONSTRAINT "PK: ${TABLE_PREFIX}aggregation::aggregation_id" PRIMARY KEY (aggregation_id)
);

CREATE TABLE ${TABLE_PREFIX}assessment
(
  assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  description character varying(100),
  explanation character varying(255),
  criteria character varying(255),
  CONSTRAINT "PK: ${TABLE_PREFIX}assessment::assessment_id" PRIMARY KEY (assessment_id)
);

CREATE TABLE ${TABLE_PREFIX}condition
(
  condition_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(100),
  description character varying(255),
  CONSTRAINT "PK: ${TABLE_PREFIX}condition::condition_id" PRIMARY KEY (condition_id)
);

CREATE TABLE ${TABLE_PREFIX}contact
(
  contact_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(150),
  email character varying(255),
  phone character varying(20),
  CONSTRAINT "PK: ${TABLE_PREFIX}contact::contact_id" PRIMARY KEY (contact_id)
);

CREATE TABLE ${TABLE_PREFIX}storage
(
  storage_id serial,
  name character varying(30),
  suffix character varying (30),
  CONSTRAINT "PK: ${TABLE_PREFIX}storage::storage_id" PRIMARY KEY (storage_id)
);

CREATE TABLE ${TABLE_PREFIX}derivative
(
  derivative_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(125),
  equation character varying(255),
  CONSTRAINT "PK: ${TABLE_PREFIX}derivative::derivative_id" PRIMARY KEY (derivative_id)
);

CREATE TABLE ${TABLE_PREFIX}hardware
(
  hardware_id uuid NOT NULL DEFAULT gen_random_uuid(),
  serial character varying(30),
  information jsonb,
  purchased date,
  CONSTRAINT "PK: ${TABLE_PREFIX}hardware::hardware_id" PRIMARY KEY (hardware_id)
);

CREATE TABLE ${TABLE_PREFIX}licence
(
  licence_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255),
  url character varying(255),
  description jsonb,
  CONSTRAINT "PK: ${TABLE_PREFIX}licence::licence_id" PRIMARY KEY (licence_id)
);

CREATE TABLE ${TABLE_PREFIX}organisation
(
  organisation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255),
  url character varying(255),
  private_sector boolean,
  CONSTRAINT "PK: ${TABLE_PREFIX}organisation::organisation_id" PRIMARY KEY (organisation_id)
);

CREATE TABLE ${TABLE_PREFIX}provider
(
  provider_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid,
  licence_id uuid,
  contact_id uuid,
  CONSTRAINT "PK: ${TABLE_PREFIX}provider::provider_id" PRIMARY KEY (provider_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}provider::organisation_id" FOREIGN KEY (organisation_id)
      REFERENCES ${TABLE_PREFIX}organisation (organisation_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FK: ${TABLE_PREFIX}provider::contact_id" FOREIGN KEY (contact_id)
      REFERENCES ${TABLE_PREFIX}contact (contact_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FK: ${TABLE_PREFIX}provider::licence_id" FOREIGN KEY (licence_id)
      REFERENCES ${TABLE_PREFIX}licence (licence_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE ${TABLE_PREFIX}technology
(
  technology_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid,
  model character varying(200),
  datasheet character varying(255),
  CONSTRAINT "PK: ${TABLE_PREFIX}technology::technology_id" PRIMARY KEY (technology_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}technology::organisation_id" FOREIGN KEY (organisation_id)
      REFERENCES ${TABLE_PREFIX}organisation (organisation_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE ${TABLE_PREFIX}unit
(
  unit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(50),
  CONSTRAINT "PK: ${TABLE_PREFIX}unit::unit_id" PRIMARY KEY (unit_id)
);

CREATE TABLE ${TABLE_PREFIX}entity
(
  entity_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255),
  meta jsonb,
  CONSTRAINT "PK: ${TABLE_PREFIX}entity::entity_id" PRIMARY KEY (entity_id)
);

CREATE TABLE "${TABLE_PREFIX}position"
(
  position_id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_id uuid,
  description character varying(255),
  notes text,
  installed timestamp without time zone,
  CONSTRAINT "PK: ${TABLE_PREFIX}position::position_id" PRIMARY KEY (position_id),
  CONSTRAINT "FK: position::entity_id" FOREIGN KEY (entity_id)
      REFERENCES ${TABLE_PREFIX}entity (entity_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE SET NULL
);

CREATE TABLE ${TABLE_PREFIX}spatial
(
  spatial_id uuid NOT NULL DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL,
  description character varying(255),
  geometry geometry,
  CONSTRAINT "PK: ${TABLE_PREFIX}spatial::spatial_id" PRIMARY KEY (spatial_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}spatial::position_id" FOREIGN KEY (position_id)
      REFERENCES "${TABLE_PREFIX}position" (position_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE ${TABLE_PREFIX}feed
(
  feed_id uuid NOT NULL DEFAULT gen_random_uuid(),
  metric character varying(255) NOT NULL,
  entity_id uuid NOT NULL,
  provider_id uuid,
  hardware_id uuid,
  technology_id uuid,
  meta jsonb,
  CONSTRAINT "PK: ${TABLE_PREFIX}feed::feed_id" PRIMARY KEY (feed_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}feed::entity_id" FOREIGN KEY (entity_id)
      REFERENCES ${TABLE_PREFIX}entity (entity_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FK: ${TABLE_PREFIX}feed::hardware_id" FOREIGN KEY (hardware_id)
      REFERENCES ${TABLE_PREFIX}hardware (hardware_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "FK: ${TABLE_PREFIX}feed::provider_id" FOREIGN KEY (provider_id)
      REFERENCES ${TABLE_PREFIX}provider (provider_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "FK: ${TABLE_PREFIX}feed::technology_id" FOREIGN KEY (technology_id)
      REFERENCES ${TABLE_PREFIX}technology (technology_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE SET NULL
);

CREATE TABLE ${TABLE_PREFIX}broker
(
  broker_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255) NOT NULL,
  active boolean,
  meta jsonb,
  CONSTRAINT "PK: ${TABLE_PREFIX}broker::broker_id" PRIMARY KEY (broker_id)
);

CREATE TABLE ${TABLE_PREFIX}brokerage
(
  brokerage_id uuid NOT NULL DEFAULT gen_random_uuid(),
  feed_id uuid NOT NULL,
  broker_id uuid NOT NULL,
  source_id character varying(255) NOT NULL,
  meta jsonb,
  CONSTRAINT "PK: ${TABLE_PREFIX}brokerage::brokerage_id" PRIMARY KEY (brokerage_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}brokerage::feed_id" FOREIGN KEY (feed_id)
      REFERENCES ${TABLE_PREFIX}feed (feed_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FK: ${TABLE_PREFIX}brokerage::broker_id" FOREIGN KEY (broker_id)
      REFERENCES ${TABLE_PREFIX}broker (broker_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE ${TABLE_PREFIX}timeseries
(
  timeseries_id uuid NOT NULL DEFAULT gen_random_uuid(),
  timeseries_num serial,
  storage_id smallint,
  unit_id uuid,
  feed_id uuid,
  CONSTRAINT "PK: ${TABLE_PREFIX}timeseries::timeseries_id" PRIMARY KEY (timeseries_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}timeseries::feed_id" FOREIGN KEY (feed_id)
      REFERENCES ${TABLE_PREFIX}feed (feed_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FK: ${TABLE_PREFIX}timeseries::storage_id" FOREIGN KEY (storage_id)
      REFERENCES ${TABLE_PREFIX}storage (storage_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FK: ${TABLE_PREFIX}timeseries::unit_id" FOREIGN KEY (unit_id)
      REFERENCES ${TABLE_PREFIX}unit (unit_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE ${TABLE_PREFIX}timeseries_aggregation
(
  timeseries_id uuid NOT NULL,
  aggregation_id uuid NOT NULL,
  CONSTRAINT "PK: ${TABLE_PREFIX}timeseries_aggregation::timeseries_id+aggregation" PRIMARY KEY (timeseries_id, aggregation_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}timeseries_aggregation::aggregation_id" FOREIGN KEY (aggregation_id)
      REFERENCES ${TABLE_PREFIX}aggregation (aggregation_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE ${TABLE_PREFIX}timeseries_assessment
(
  timeseries_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  CONSTRAINT "PK: ${TABLE_PREFIX}timeseries_assessment::timeseries_id+assessment_id" PRIMARY KEY (timeseries_id, assessment_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}timeseries_assessment::assessment_id" FOREIGN KEY (assessment_id)
      REFERENCES ${TABLE_PREFIX}assessment (assessment_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FK: ${TABLE_PREFIX}timeseries_assessment::timeseries_id" FOREIGN KEY (timeseries_id)
      REFERENCES ${TABLE_PREFIX}timeseries (timeseries_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE ${TABLE_PREFIX}timeseries_derivative
(
  timeseries_id uuid NOT NULL,
  derivative_id uuid NOT NULL,
  CONSTRAINT "PK: ${TABLE_PREFIX}timeseries_derivative::timeseries_id+derivative_id" PRIMARY KEY (timeseries_id, derivative_id)
);

CREATE TABLE ${TABLE_PREFIX}service
(
  service_id uuid NOT NULL DEFAULT gen_random_uuid(),
  "time" timestamp without time zone,
  condition_id uuid,
  notes text,
  feed_id uuid,
  CONSTRAINT "PK: ${TABLE_PREFIX}service::service_id" PRIMARY KEY (service_id),
  CONSTRAINT "FK: ${TABLE_PREFIX}service::feed_id" FOREIGN KEY (feed_id)
      REFERENCES ${TABLE_PREFIX}feed (feed_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "FK: ${TABLE_PREFIX}service::condition_id" FOREIGN KEY (condition_id)
      REFERENCES ${TABLE_PREFIX}condition (condition_id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX "IDX: ${TABLE_PREFIX}feed::entity_id"
  ON ${TABLE_PREFIX}feed
  USING btree
  (entity_id);
ALTER TABLE ${TABLE_PREFIX}feed CLUSTER ON "IDX: ${TABLE_PREFIX}feed::entity_id";

CREATE INDEX "IDX: ${TABLE_PREFIX}feed::hardware_id"
  ON ${TABLE_PREFIX}feed
  USING btree
  (hardware_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}feed::provider_id"
  ON ${TABLE_PREFIX}feed
  USING btree
  (provider_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}feed::technology_id"
  ON ${TABLE_PREFIX}feed
  USING btree
  (technology_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}provider::organisation_id"
  ON ${TABLE_PREFIX}provider
  USING btree
  (organisation_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}service::feed_id"
  ON ${TABLE_PREFIX}service
  USING btree
  (feed_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}spatial::position_id"
  ON ${TABLE_PREFIX}spatial
  USING btree
  (position_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}technology::organisation_id"
  ON ${TABLE_PREFIX}technology
  USING btree
  (organisation_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}timeseries::feed_id"
  ON ${TABLE_PREFIX}timeseries
  USING btree
  (feed_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}brokerage::feed_id"
  ON ${TABLE_PREFIX}brokerage
  USING btree
  (feed_id);

CREATE INDEX "IDX: ${TABLE_PREFIX}brokerage::broker_id"
  ON ${TABLE_PREFIX}brokerage
  USING btree
  (broker_id);

CREATE UNIQUE INDEX "IDX: ${TABLE_PREFIX}broker::name"
   ON ${TABLE_PREFIX}broker
   USING btree
   (name ASC NULLS LAST);

CREATE UNIQUE INDEX "IDX: ${TABLE_PREFIX}entity::name"
   ON ${TABLE_PREFIX}entity
   USING btree
   (name ASC NULLS LAST);

ALTER TABLE ${TABLE_PREFIX}brokerage
  ADD CONSTRAINT "CON: ${TABLE_PREFIX}brokerage UNIQUE"
  UNIQUE (feed_id, source_id, broker_id);

ALTER TABLE ${TABLE_PREFIX}unit
  ADD CONSTRAINT "CON: ${TABLE_PREFIX}unit UNIQUE"
  UNIQUE (name);

ALTER TABLE ${TABLE_PREFIX}storage
  ADD CONSTRAINT "CON: ${TABLE_PREFIX}storage UNIQUE"
  UNIQUE (name);

ALTER TABLE ${TABLE_PREFIX}timeseries
  ADD CONSTRAINT "CON: ${TABLE_PREFIX}timeseries::timeseries_num"
  UNIQUE (timeseries_num);

-- Storage types should never change their IDs, or bad things will happen
-- Only ever add new types.
INSERT INTO ${TABLE_PREFIX}storage (name, suffix) VALUES ('Boolean', 'bool');
INSERT INTO ${TABLE_PREFIX}storage (name, suffix) VALUES ('Integer', 'int');
INSERT INTO ${TABLE_PREFIX}storage (name, suffix) VALUES ('Real', 'real');
INSERT INTO ${TABLE_PREFIX}storage (name, suffix) VALUES ('String', 'string');
INSERT INTO ${TABLE_PREFIX}storage (name, suffix) VALUES ('Timestamp', 'ts');
INSERT INTO ${TABLE_PREFIX}storage (name, suffix) VALUES ('Event', 'event');
INSERT INTO ${TABLE_PREFIX}storage (name, suffix) VALUES ('File', 'file');
INSERT INTO ${TABLE_PREFIX}storage (name, suffix) VALUES ('JSON', 'json');

-- Hypertables with Timescale
--  - JSON
CREATE TABLE ${TABLE_PREFIX}data_json
(
   "time" timestamp without time zone NOT NULL,
   timeseries_num integer,
   duration real,
   value jsonb NOT NULL,
   CONSTRAINT "PK: ${TABLE_PREFIX}data_json::timeseries_num+datetime"
     PRIMARY KEY ("time", timeseries_num),
   CONSTRAINT "FK: ${TABLE_PREFIX}data_json::timeseries_num" FOREIGN KEY (timeseries_num)
     REFERENCES ${TABLE_PREFIX}timeseries (timeseries_num) MATCH SIMPLE
     ON UPDATE NO ACTION ON DELETE NO ACTION
);
SELECT create_hypertable('${TABLE_PREFIX}data_json', 'time', chunk_time_interval => interval '21 days');

--  - Boolean
CREATE TABLE ${TABLE_PREFIX}data_bool
(
   "time" timestamp without time zone NOT NULL,
   timeseries_num integer,
   duration real,
   value boolean NOT NULL,
   CONSTRAINT "PK: ${TABLE_PREFIX}data_bool::timeseries_num+datetime"
     PRIMARY KEY ("time", timeseries_num),
   CONSTRAINT "FK: ${TABLE_PREFIX}data_bool::timeseries_num" FOREIGN KEY (timeseries_num)
     REFERENCES ${TABLE_PREFIX}timeseries (timeseries_num) MATCH SIMPLE
     ON UPDATE NO ACTION ON DELETE NO ACTION
);
SELECT create_hypertable('${TABLE_PREFIX}data_bool', 'time', chunk_time_interval => interval '21 days');

--  - Integer
CREATE TABLE ${TABLE_PREFIX}data_int
(
   "time" timestamp without time zone NOT NULL,
   timeseries_num integer,
   duration real,
   value integer NOT NULL,
   CONSTRAINT "PK: ${TABLE_PREFIX}data_int::timeseries_num+datetime"
     PRIMARY KEY ("time", timeseries_num),
   CONSTRAINT "FK: ${TABLE_PREFIX}data_int::timeseries_num" FOREIGN KEY (timeseries_num)
     REFERENCES ${TABLE_PREFIX}timeseries (timeseries_num) MATCH SIMPLE
     ON UPDATE NO ACTION ON DELETE NO ACTION
);
SELECT create_hypertable('${TABLE_PREFIX}data_int', 'time', chunk_time_interval => interval '21 days');

--  - Real
CREATE TABLE ${TABLE_PREFIX}data_real
(
   "time" timestamp without time zone NOT NULL,
   timeseries_num integer,
   duration real,
   value real NOT NULL,
   CONSTRAINT "PK: ${TABLE_PREFIX}data_real::timeseries_num+datetime"
     PRIMARY KEY ("time", timeseries_num),
   CONSTRAINT "FK: ${TABLE_PREFIX}data_real::timeseries_num" FOREIGN KEY (timeseries_num)
     REFERENCES ${TABLE_PREFIX}timeseries (timeseries_num) MATCH SIMPLE
     ON UPDATE NO ACTION ON DELETE NO ACTION
);
SELECT create_hypertable('${TABLE_PREFIX}data_real', 'time', chunk_time_interval => interval '21 days');

--  - String
CREATE TABLE ${TABLE_PREFIX}data_string
(
   "time" timestamp without time zone NOT NULL,
   timeseries_num integer,
   duration real,
   value character varying(100) NOT NULL,
   CONSTRAINT "PK: ${TABLE_PREFIX}data_string::timeseries_num+datetime"
     PRIMARY KEY ("time", timeseries_num),
   CONSTRAINT "FK: ${TABLE_PREFIX}data_string::timeseries_num" FOREIGN KEY (timeseries_num)
     REFERENCES ${TABLE_PREFIX}timeseries (timeseries_num) MATCH SIMPLE
     ON UPDATE NO ACTION ON DELETE NO ACTION
);
SELECT create_hypertable('${TABLE_PREFIX}data_string', 'time', chunk_time_interval => interval '21 days');

--  - Timestamp
CREATE TABLE ${TABLE_PREFIX}data_ts
(
   "time" timestamp without time zone NOT NULL,
   timeseries_num integer,
   duration real,
   value timestamp without time zone NOT NULL,
   CONSTRAINT "PK: ${TABLE_PREFIX}data_ts::timeseries_num+datetime"
     PRIMARY KEY ("time", timeseries_num),
   CONSTRAINT "FK: ${TABLE_PREFIX}data_ts::timeseries_num" FOREIGN KEY (timeseries_num)
     REFERENCES ${TABLE_PREFIX}timeseries (timeseries_num) MATCH SIMPLE
     ON UPDATE NO ACTION ON DELETE NO ACTION
);
SELECT create_hypertable('${TABLE_PREFIX}data_ts', 'time', chunk_time_interval => interval '21 days');

--  - Event
CREATE TABLE ${TABLE_PREFIX}data_event
(
   "time" timestamp without time zone NOT NULL,
   timeseries_num integer,
   duration real,
   CONSTRAINT "PK: ${TABLE_PREFIX}data_event::timeseries_num+datetime"
     PRIMARY KEY ("time", timeseries_num),
   CONSTRAINT "FK: ${TABLE_PREFIX}data_event::timeseries_num" FOREIGN KEY (timeseries_num)
     REFERENCES ${TABLE_PREFIX}timeseries (timeseries_num) MATCH SIMPLE
     ON UPDATE NO ACTION ON DELETE NO ACTION
);
SELECT create_hypertable('${TABLE_PREFIX}data_event', 'time', chunk_time_interval => interval '21 days');

--  - File
CREATE TABLE ${TABLE_PREFIX}data_file
(
   "time" timestamp without time zone NOT NULL,
   timeseries_num integer,
   duration real,
   value character varying(255) NOT NULL,
   CONSTRAINT "PK: ${TABLE_PREFIX}data_file::timeseries_num+datetime"
     PRIMARY KEY ("time", timeseries_num),
   CONSTRAINT "FK: ${TABLE_PREFIX}data_file::timeseries_num" FOREIGN KEY (timeseries_num)
     REFERENCES ${TABLE_PREFIX}timeseries (timeseries_num) MATCH SIMPLE
     ON UPDATE NO ACTION ON DELETE NO ACTION
);
SELECT create_hypertable('${TABLE_PREFIX}data_file', 'time', chunk_time_interval => interval '21 days');

-- Meta indexes
CREATE INDEX "IDX: ${TABLE_PREFIX}entity::meta"
  ON ${TABLE_PREFIX}entity
  USING gin
  (meta jsonb_path_ops);

CREATE INDEX "IDX: ${TABLE_PREFIX}feed::meta"
  ON ${TABLE_PREFIX}feed
  USING gin
  (meta jsonb_path_ops);

CREATE INDEX "IDX: ${TABLE_PREFIX}broker::meta"
  ON ${TABLE_PREFIX}broker
  USING gin
  (meta jsonb_path_ops);

CREATE INDEX "IDX: ${TABLE_PREFIX}brokerage::meta"
  ON ${TABLE_PREFIX}brokerage
  USING gin
  (meta jsonb_path_ops);
