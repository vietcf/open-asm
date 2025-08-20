--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agents (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    version character varying(50),
    description text
);


ALTER TABLE public.agents OWNER TO postgres;

--
-- Name: agents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.agents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agents_id_seq OWNER TO postgres;

--
-- Name: agents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.agents_id_seq OWNED BY public.agents.id;


--
-- Name: configuration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuration (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(100)
);


ALTER TABLE public.configuration OWNER TO postgres;

--
-- Name: configuration_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuration_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuration_id_seq OWNER TO postgres;

--
-- Name: configuration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuration_id_seq OWNED BY public.configuration.id;


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100),
    phone character varying(20),
    unit_id integer,
    "position" character varying(100),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.contacts OWNER TO postgres;

--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contacts_id_seq OWNER TO postgres;

--
-- Name: contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contacts_id_seq OWNED BY public.contacts.id;


--
-- Name: device_contact; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_contact (
    device_id integer NOT NULL,
    contact_id integer NOT NULL
);


ALTER TABLE public.device_contact OWNER TO postgres;

--
-- Name: device_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_types (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.device_types OWNER TO postgres;

--
-- Name: device_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.device_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_types_id_seq OWNER TO postgres;

--
-- Name: device_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.device_types_id_seq OWNED BY public.device_types.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.devices (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    serial_number character varying(100),
    device_type_id integer,
    platform_id integer,
    location text,
    management_address character varying(255),
    description text,
    manufacturer character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(64)
);


ALTER TABLE public.devices OWNER TO postgres;

--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.devices_id_seq OWNER TO postgres;

--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domains (
    id integer NOT NULL,
    domain character varying(255) NOT NULL,
    description text,
    ip_id integer,
    record_type character varying(16)
);


ALTER TABLE public.domains OWNER TO postgres;

--
-- Name: domains_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.domains_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.domains_id_seq OWNER TO postgres;

--
-- Name: domains_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.domains_id_seq OWNED BY public.domains.id;


--
-- Name: file_uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.file_uploads (
    id integer NOT NULL,
    object_type character varying(50) NOT NULL,
    object_id integer NOT NULL,
    original_name character varying(255) NOT NULL,
    file_path character varying(255) NOT NULL,
    mime_type character varying(100),
    size bigint,
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.file_uploads OWNER TO postgres;

--
-- Name: file_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.file_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.file_uploads_id_seq OWNER TO postgres;

--
-- Name: file_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.file_uploads_id_seq OWNED BY public.file_uploads.id;


--
-- Name: ip_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ip_addresses (
    id integer NOT NULL,
    ip_address character varying(64) NOT NULL,
    description text,
    server_id integer,
    status character varying(32),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(128),
    device_id integer
);


ALTER TABLE public.ip_addresses OWNER TO postgres;

--
-- Name: ip_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ip_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ip_addresses_id_seq OWNER TO postgres;

--
-- Name: ip_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ip_addresses_id_seq OWNED BY public.ip_addresses.id;


--
-- Name: ip_contact; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ip_contact (
    ip_id integer NOT NULL,
    contact_id integer NOT NULL
);


ALTER TABLE public.ip_contact OWNER TO postgres;

--
-- Name: ip_tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ip_tag (
    ip_id integer NOT NULL,
    tag_id integer NOT NULL
);


ALTER TABLE public.ip_tag OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: platforms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platforms (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.platforms OWNER TO postgres;

--
-- Name: platforms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.platforms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.platforms_id_seq OWNER TO postgres;

--
-- Name: platforms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.platforms_id_seq OWNED BY public.platforms.id;


--
-- Name: priv_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priv_permissions (
    id integer NOT NULL,
    name text NOT NULL,
    system_id integer NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(100)
);


ALTER TABLE public.priv_permissions OWNER TO postgres;

--
-- Name: priv_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priv_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priv_permissions_id_seq OWNER TO postgres;

--
-- Name: priv_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priv_permissions_id_seq OWNED BY public.priv_permissions.id;


--
-- Name: priv_role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priv_role_permissions (
    id integer NOT NULL,
    role_id integer,
    permission_id integer
);


ALTER TABLE public.priv_role_permissions OWNER TO postgres;

--
-- Name: priv_role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priv_role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priv_role_permissions_id_seq OWNER TO postgres;

--
-- Name: priv_role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priv_role_permissions_id_seq OWNED BY public.priv_role_permissions.id;


--
-- Name: priv_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priv_roles (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    system_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(100)
);


ALTER TABLE public.priv_roles OWNER TO postgres;

--
-- Name: priv_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priv_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priv_roles_id_seq OWNER TO postgres;

--
-- Name: priv_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priv_roles_id_seq OWNED BY public.priv_roles.id;


--
-- Name: priv_user_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priv_user_contacts (
    id integer NOT NULL,
    user_id integer,
    contact_id integer
);


ALTER TABLE public.priv_user_contacts OWNER TO postgres;

--
-- Name: priv_user_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priv_user_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priv_user_contacts_id_seq OWNER TO postgres;

--
-- Name: priv_user_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priv_user_contacts_id_seq OWNED BY public.priv_user_contacts.id;


--
-- Name: priv_user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priv_user_roles (
    id integer NOT NULL,
    user_id integer,
    role_id integer
);


ALTER TABLE public.priv_user_roles OWNER TO postgres;

--
-- Name: priv_user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priv_user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priv_user_roles_id_seq OWNER TO postgres;

--
-- Name: priv_user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priv_user_roles_id_seq OWNED BY public.priv_user_roles.id;


--
-- Name: priv_user_servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priv_user_servers (
    id integer NOT NULL,
    user_id integer,
    server_id integer
);


ALTER TABLE public.priv_user_servers OWNER TO postgres;

--
-- Name: priv_user_servers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priv_user_servers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priv_user_servers_id_seq OWNER TO postgres;

--
-- Name: priv_user_servers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priv_user_servers_id_seq OWNED BY public.priv_user_servers.id;


--
-- Name: priv_user_systems; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priv_user_systems (
    id integer NOT NULL,
    user_id integer,
    system_id integer
);


ALTER TABLE public.priv_user_systems OWNER TO postgres;

--
-- Name: priv_user_systems_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priv_user_systems_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priv_user_systems_id_seq OWNER TO postgres;

--
-- Name: priv_user_systems_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priv_user_systems_id_seq OWNED BY public.priv_user_systems.id;


--
-- Name: priv_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priv_users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    description text,
    organize_id integer,
    role_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(100),
    account_type character varying(255) NOT NULL,
    manage_type character varying(255) NOT NULL,
    app_url character varying(255)
);


ALTER TABLE public.priv_users OWNER TO postgres;

--
-- Name: priv_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priv_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priv_users_id_seq OWNER TO postgres;

--
-- Name: priv_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priv_users_id_seq OWNED BY public.priv_users.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer,
    permission_id integer
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_permissions_id_seq OWNER TO postgres;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: rulefirewall; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rulefirewall (
    id integer NOT NULL,
    rulename character varying(255) NOT NULL,
    firewall_name character varying(255),
    src_zone character varying(128),
    src text,
    src_detail text,
    dst_zone character varying(128),
    dst text,
    dst_detail text,
    services character varying(255),
    application character varying(255),
    url character varying(255),
    action character varying(32) NOT NULL,
    violation_type character varying(128),
    violation_detail text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(128),
    ou_id integer,
    solution_proposal text,
    solution_confirm text,
    status character varying(64),
    description text,
    audit_batch text,
    work_order text
);


ALTER TABLE public.rulefirewall OWNER TO postgres;

--
-- Name: rulefirewall_contact; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rulefirewall_contact (
    rule_id integer NOT NULL,
    contact_id integer NOT NULL
);


ALTER TABLE public.rulefirewall_contact OWNER TO postgres;

--
-- Name: rulefirewall_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rulefirewall_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rulefirewall_id_seq OWNER TO postgres;

--
-- Name: rulefirewall_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rulefirewall_id_seq OWNED BY public.rulefirewall.id;


--
-- Name: server_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_agents (
    server_id integer NOT NULL,
    agent_id integer NOT NULL
);


ALTER TABLE public.server_agents OWNER TO postgres;

--
-- Name: server_contact; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_contact (
    server_id integer NOT NULL,
    contact_id integer NOT NULL
);


ALTER TABLE public.server_contact OWNER TO postgres;

--
-- Name: server_services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_services (
    server_id integer NOT NULL,
    service_id integer NOT NULL
);


ALTER TABLE public.server_services OWNER TO postgres;

--
-- Name: server_system; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_system (
    server_id integer NOT NULL,
    system_id integer NOT NULL
);


ALTER TABLE public.server_system OWNER TO postgres;

--
-- Name: servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    os_id integer,
    location text,
    type text,
    status character varying(16) DEFAULT NULL::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(64)
);


ALTER TABLE public.servers OWNER TO postgres;

--
-- Name: servers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servers_id_seq OWNER TO postgres;

--
-- Name: servers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servers_id_seq OWNED BY public.servers.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.services OWNER TO postgres;

--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.services_id_seq OWNER TO postgres;

--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: subnets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subnets (
    id integer NOT NULL,
    address inet NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.subnets OWNER TO postgres;

--
-- Name: subnets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subnets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subnets_id_seq OWNER TO postgres;

--
-- Name: subnets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subnets_id_seq OWNED BY public.subnets.id;


--
-- Name: system_contact; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_contact (
    id integer NOT NULL,
    system_id integer,
    contact_id integer
);


ALTER TABLE public.system_contact OWNER TO postgres;

--
-- Name: system_contact_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_contact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_contact_id_seq OWNER TO postgres;

--
-- Name: system_contact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_contact_id_seq OWNED BY public.system_contact.id;


--
-- Name: system_domain; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_domain (
    system_id integer NOT NULL,
    domain_id integer NOT NULL
);


ALTER TABLE public.system_domain OWNER TO postgres;

--
-- Name: system_ip; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_ip (
    id integer NOT NULL,
    system_id integer,
    ip_id integer
);


ALTER TABLE public.system_ip OWNER TO postgres;

--
-- Name: system_ip_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_ip_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_ip_id_seq OWNER TO postgres;

--
-- Name: system_ip_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_ip_id_seq OWNED BY public.system_ip.id;


--
-- Name: system_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_log (
    id integer NOT NULL,
    action character varying(100) NOT NULL,
    object_type character varying(100),
    object_id character varying(100),
    description text,
    user_id integer,
    username character varying(100),
    ip_address character varying(50),
    user_agent text,
    status character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_log OWNER TO postgres;

--
-- Name: system_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_log_id_seq OWNER TO postgres;

--
-- Name: system_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_log_id_seq OWNED BY public.system_log.id;


--
-- Name: system_server; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_server (
    id integer NOT NULL,
    system_id integer,
    server_id integer
);


ALTER TABLE public.system_server OWNER TO postgres;

--
-- Name: system_server_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_server_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_server_id_seq OWNER TO postgres;

--
-- Name: system_server_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_server_id_seq OWNED BY public.system_server.id;


--
-- Name: system_tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_tag (
    system_id integer NOT NULL,
    tag_id integer NOT NULL
);


ALTER TABLE public.system_tag OWNER TO postgres;

--
-- Name: systems; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.systems (
    id integer NOT NULL,
    system_id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    level character varying(50),
    department_id integer,
    alias text[],
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(255)
);


ALTER TABLE public.systems OWNER TO postgres;

--
-- Name: systems_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.systems_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.systems_id_seq OWNER TO postgres;

--
-- Name: systems_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.systems_id_seq OWNED BY public.systems.id;


--
-- Name: tag_object; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tag_object (
    tag_id integer NOT NULL,
    object_type character varying(32) NOT NULL,
    object_id integer NOT NULL
);


ALTER TABLE public.tag_object OWNER TO postgres;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id integer NOT NULL,
    name character varying(128) NOT NULL,
    description text
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- Name: tags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tags_id_seq OWNER TO postgres;

--
-- Name: tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.units (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    description character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.units OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.units_id_seq OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    email character varying(100),
    fullname character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    role_id integer,
    twofa_secret character varying(64),
    twofa_enabled boolean DEFAULT false,
    require_twofa boolean DEFAULT false,
    twofa_setup_deadline timestamp without time zone,
    must_change_password boolean DEFAULT false
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: agents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents ALTER COLUMN id SET DEFAULT nextval('public.agents_id_seq'::regclass);


--
-- Name: configuration id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration ALTER COLUMN id SET DEFAULT nextval('public.configuration_id_seq'::regclass);


--
-- Name: contacts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts ALTER COLUMN id SET DEFAULT nextval('public.contacts_id_seq'::regclass);


--
-- Name: device_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_types ALTER COLUMN id SET DEFAULT nextval('public.device_types_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: domains id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domains ALTER COLUMN id SET DEFAULT nextval('public.domains_id_seq'::regclass);


--
-- Name: file_uploads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_uploads ALTER COLUMN id SET DEFAULT nextval('public.file_uploads_id_seq'::regclass);


--
-- Name: ip_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_addresses ALTER COLUMN id SET DEFAULT nextval('public.ip_addresses_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: platforms id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platforms ALTER COLUMN id SET DEFAULT nextval('public.platforms_id_seq'::regclass);


--
-- Name: priv_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_permissions ALTER COLUMN id SET DEFAULT nextval('public.priv_permissions_id_seq'::regclass);


--
-- Name: priv_role_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_role_permissions ALTER COLUMN id SET DEFAULT nextval('public.priv_role_permissions_id_seq'::regclass);


--
-- Name: priv_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_roles ALTER COLUMN id SET DEFAULT nextval('public.priv_roles_id_seq'::regclass);


--
-- Name: priv_user_contacts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_contacts ALTER COLUMN id SET DEFAULT nextval('public.priv_user_contacts_id_seq'::regclass);


--
-- Name: priv_user_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_roles ALTER COLUMN id SET DEFAULT nextval('public.priv_user_roles_id_seq'::regclass);


--
-- Name: priv_user_servers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_servers ALTER COLUMN id SET DEFAULT nextval('public.priv_user_servers_id_seq'::regclass);


--
-- Name: priv_user_systems id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_systems ALTER COLUMN id SET DEFAULT nextval('public.priv_user_systems_id_seq'::regclass);


--
-- Name: priv_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_users ALTER COLUMN id SET DEFAULT nextval('public.priv_users_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: rulefirewall id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rulefirewall ALTER COLUMN id SET DEFAULT nextval('public.rulefirewall_id_seq'::regclass);


--
-- Name: servers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers ALTER COLUMN id SET DEFAULT nextval('public.servers_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: subnets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subnets ALTER COLUMN id SET DEFAULT nextval('public.subnets_id_seq'::regclass);


--
-- Name: system_contact id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_contact ALTER COLUMN id SET DEFAULT nextval('public.system_contact_id_seq'::regclass);


--
-- Name: system_ip id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_ip ALTER COLUMN id SET DEFAULT nextval('public.system_ip_id_seq'::regclass);


--
-- Name: system_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_log ALTER COLUMN id SET DEFAULT nextval('public.system_log_id_seq'::regclass);


--
-- Name: system_server id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_server ALTER COLUMN id SET DEFAULT nextval('public.system_server_id_seq'::regclass);


--
-- Name: systems id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.systems ALTER COLUMN id SET DEFAULT nextval('public.systems_id_seq'::regclass);


--
-- Name: tags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags ALTER COLUMN id SET DEFAULT nextval('public.tags_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: agents agents_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_name_key UNIQUE (name);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: configuration configuration_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration
    ADD CONSTRAINT configuration_key_key UNIQUE (key);


--
-- Name: configuration configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration
    ADD CONSTRAINT configuration_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: device_contact device_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_contact
    ADD CONSTRAINT device_contact_pkey PRIMARY KEY (device_id, contact_id);


--
-- Name: device_types device_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_types
    ADD CONSTRAINT device_types_name_key UNIQUE (name);


--
-- Name: device_types device_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_types
    ADD CONSTRAINT device_types_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: domains domains_domain_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_domain_key UNIQUE (domain);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: file_uploads file_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_uploads
    ADD CONSTRAINT file_uploads_pkey PRIMARY KEY (id);


--
-- Name: ip_addresses ip_addresses_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_addresses
    ADD CONSTRAINT ip_addresses_ip_address_key UNIQUE (ip_address);


--
-- Name: ip_addresses ip_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_addresses
    ADD CONSTRAINT ip_addresses_pkey PRIMARY KEY (id);


--
-- Name: ip_contact ip_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_contact
    ADD CONSTRAINT ip_contact_pkey PRIMARY KEY (ip_id, contact_id);


--
-- Name: ip_tag ip_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_tag
    ADD CONSTRAINT ip_tag_pkey PRIMARY KEY (ip_id, tag_id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: platforms platforms_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platforms
    ADD CONSTRAINT platforms_name_key UNIQUE (name);


--
-- Name: platforms platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platforms
    ADD CONSTRAINT platforms_pkey PRIMARY KEY (id);


--
-- Name: priv_permissions priv_permissions_name_system_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_permissions
    ADD CONSTRAINT priv_permissions_name_system_id_key UNIQUE (name, system_id);


--
-- Name: priv_permissions priv_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_permissions
    ADD CONSTRAINT priv_permissions_pkey PRIMARY KEY (id);


--
-- Name: priv_role_permissions priv_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_role_permissions
    ADD CONSTRAINT priv_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: priv_roles priv_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_roles
    ADD CONSTRAINT priv_roles_pkey PRIMARY KEY (id);


--
-- Name: priv_user_contacts priv_user_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_contacts
    ADD CONSTRAINT priv_user_contacts_pkey PRIMARY KEY (id);


--
-- Name: priv_user_roles priv_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_roles
    ADD CONSTRAINT priv_user_roles_pkey PRIMARY KEY (id);


--
-- Name: priv_user_servers priv_user_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_servers
    ADD CONSTRAINT priv_user_servers_pkey PRIMARY KEY (id);


--
-- Name: priv_user_systems priv_user_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_systems
    ADD CONSTRAINT priv_user_systems_pkey PRIMARY KEY (id);


--
-- Name: priv_users priv_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_users
    ADD CONSTRAINT priv_users_pkey PRIMARY KEY (id);


--
-- Name: priv_users priv_users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_users
    ADD CONSTRAINT priv_users_username_key UNIQUE (username);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: rulefirewall_contact rulefirewall_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rulefirewall_contact
    ADD CONSTRAINT rulefirewall_contact_pkey PRIMARY KEY (rule_id, contact_id);


--
-- Name: rulefirewall rulefirewall_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rulefirewall
    ADD CONSTRAINT rulefirewall_pkey PRIMARY KEY (id);


--
-- Name: server_agents server_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_agents
    ADD CONSTRAINT server_agents_pkey PRIMARY KEY (server_id, agent_id);


--
-- Name: server_contact server_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_contact
    ADD CONSTRAINT server_contact_pkey PRIMARY KEY (server_id, contact_id);


--
-- Name: server_services server_services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_services
    ADD CONSTRAINT server_services_pkey PRIMARY KEY (server_id, service_id);


--
-- Name: server_system server_system_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_system
    ADD CONSTRAINT server_system_pkey PRIMARY KEY (server_id, system_id);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: services services_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_name_key UNIQUE (name);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: subnets subnets_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subnets
    ADD CONSTRAINT subnets_address_key UNIQUE (address);


--
-- Name: subnets subnets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subnets
    ADD CONSTRAINT subnets_pkey PRIMARY KEY (id);


--
-- Name: system_contact system_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_contact
    ADD CONSTRAINT system_contact_pkey PRIMARY KEY (id);


--
-- Name: system_domain system_domain_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_domain
    ADD CONSTRAINT system_domain_pkey PRIMARY KEY (system_id, domain_id);


--
-- Name: system_ip system_ip_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_ip
    ADD CONSTRAINT system_ip_pkey PRIMARY KEY (id);


--
-- Name: system_log system_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_log
    ADD CONSTRAINT system_log_pkey PRIMARY KEY (id);


--
-- Name: system_server system_server_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_server
    ADD CONSTRAINT system_server_pkey PRIMARY KEY (id);


--
-- Name: system_tag system_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_tag
    ADD CONSTRAINT system_tag_pkey PRIMARY KEY (system_id, tag_id);


--
-- Name: systems systems_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_name_key UNIQUE (name);


--
-- Name: systems systems_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_pkey PRIMARY KEY (id);


--
-- Name: systems systems_system_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_system_id_key UNIQUE (system_id);


--
-- Name: tag_object tag_object_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_object
    ADD CONSTRAINT tag_object_pkey PRIMARY KEY (tag_id, object_type, object_id);


--
-- Name: tags tags_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: priv_roles uniq_priv_role_name_system; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_roles
    ADD CONSTRAINT uniq_priv_role_name_system UNIQUE (name, system_id);


--
-- Name: units units_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_name_key UNIQUE (name);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: device_contact device_contact_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_contact
    ADD CONSTRAINT device_contact_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: device_contact device_contact_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_contact
    ADD CONSTRAINT device_contact_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;


--
-- Name: devices devices_device_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_device_type_id_fkey FOREIGN KEY (device_type_id) REFERENCES public.device_types(id) ON DELETE SET NULL;


--
-- Name: devices devices_platform_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms(id) ON DELETE SET NULL;


--
-- Name: domains domains_ip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_ip_id_fkey FOREIGN KEY (ip_id) REFERENCES public.ip_addresses(id) ON DELETE SET NULL;


--
-- Name: ip_addresses ip_addresses_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_addresses
    ADD CONSTRAINT ip_addresses_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE SET NULL;


--
-- Name: ip_addresses ip_addresses_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_addresses
    ADD CONSTRAINT ip_addresses_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE SET NULL;


--
-- Name: ip_contact ip_contact_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_contact
    ADD CONSTRAINT ip_contact_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: ip_contact ip_contact_ip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_contact
    ADD CONSTRAINT ip_contact_ip_id_fkey FOREIGN KEY (ip_id) REFERENCES public.ip_addresses(id) ON DELETE CASCADE;


--
-- Name: ip_tag ip_tag_ip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_tag
    ADD CONSTRAINT ip_tag_ip_id_fkey FOREIGN KEY (ip_id) REFERENCES public.ip_addresses(id) ON DELETE CASCADE;


--
-- Name: ip_tag ip_tag_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ip_tag
    ADD CONSTRAINT ip_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: priv_role_permissions priv_role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_role_permissions
    ADD CONSTRAINT priv_role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.priv_permissions(id) ON DELETE CASCADE;


--
-- Name: priv_role_permissions priv_role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_role_permissions
    ADD CONSTRAINT priv_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.priv_roles(id) ON DELETE CASCADE;


--
-- Name: priv_roles priv_roles_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_roles
    ADD CONSTRAINT priv_roles_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE SET NULL;


--
-- Name: priv_user_contacts priv_user_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_contacts
    ADD CONSTRAINT priv_user_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: priv_user_contacts priv_user_contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_contacts
    ADD CONSTRAINT priv_user_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.priv_users(id) ON DELETE CASCADE;


--
-- Name: priv_user_roles priv_user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_roles
    ADD CONSTRAINT priv_user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.priv_roles(id) ON DELETE CASCADE;


--
-- Name: priv_user_roles priv_user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_roles
    ADD CONSTRAINT priv_user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.priv_users(id) ON DELETE CASCADE;


--
-- Name: priv_user_servers priv_user_servers_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_servers
    ADD CONSTRAINT priv_user_servers_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: priv_user_servers priv_user_servers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_servers
    ADD CONSTRAINT priv_user_servers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.priv_users(id) ON DELETE CASCADE;


--
-- Name: priv_user_systems priv_user_systems_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_systems
    ADD CONSTRAINT priv_user_systems_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: priv_user_systems priv_user_systems_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_user_systems
    ADD CONSTRAINT priv_user_systems_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.priv_users(id) ON DELETE CASCADE;


--
-- Name: priv_users priv_users_organize_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_users
    ADD CONSTRAINT priv_users_organize_id_fkey FOREIGN KEY (organize_id) REFERENCES public.units(id);


--
-- Name: priv_users priv_users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priv_users
    ADD CONSTRAINT priv_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.priv_roles(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: rulefirewall_contact rulefirewall_contact_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rulefirewall_contact
    ADD CONSTRAINT rulefirewall_contact_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: rulefirewall_contact rulefirewall_contact_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rulefirewall_contact
    ADD CONSTRAINT rulefirewall_contact_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.rulefirewall(id) ON DELETE CASCADE;


--
-- Name: rulefirewall rulefirewall_ou_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rulefirewall
    ADD CONSTRAINT rulefirewall_ou_id_fkey FOREIGN KEY (ou_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: server_agents server_agents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_agents
    ADD CONSTRAINT server_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: server_agents server_agents_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_agents
    ADD CONSTRAINT server_agents_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_services server_services_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_services
    ADD CONSTRAINT server_services_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: server_services server_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_services
    ADD CONSTRAINT server_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: system_contact system_contact_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_contact
    ADD CONSTRAINT system_contact_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: system_contact system_contact_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_contact
    ADD CONSTRAINT system_contact_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_domain system_domain_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_domain
    ADD CONSTRAINT system_domain_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: system_domain system_domain_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_domain
    ADD CONSTRAINT system_domain_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_ip system_ip_ip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_ip
    ADD CONSTRAINT system_ip_ip_id_fkey FOREIGN KEY (ip_id) REFERENCES public.ip_addresses(id) ON DELETE CASCADE;


--
-- Name: system_ip system_ip_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_ip
    ADD CONSTRAINT system_ip_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_server system_server_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_server
    ADD CONSTRAINT system_server_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: system_server system_server_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_server
    ADD CONSTRAINT system_server_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_tag system_tag_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_tag
    ADD CONSTRAINT system_tag_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_tag system_tag_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_tag
    ADD CONSTRAINT system_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: systems systems_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.units(id);


--
-- Name: tag_object tag_object_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_object
    ADD CONSTRAINT tag_object_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

