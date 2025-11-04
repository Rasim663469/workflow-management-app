--
-- PostgreSQL database dump
--

\restrict X9FDxiifpqzHJMePnAPxvxqP4NPyBSQZhSMsYim9Kuq9j3DbJq9vmlau88pdXEr

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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
-- Name: users; Type: TABLE; Schema: public; Owner: secureapp
--

CREATE TABLE public.users (
    id integer NOT NULL,
    login text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'user'::text
);


ALTER TABLE public.users OWNER TO secureapp;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: secureapp
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO secureapp;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: secureapp
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: secureapp
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: secureapp
--

COPY public.users (id, login, password_hash, role) FROM stdin;
1	admin	$2b$10$PoWQxB5JH5VNB4/15WwU2OVvikIOFueJ9YZbQVuX/EjwmS5YmYeBC	admin
2	alice	$2b$10$yT.iWHU0X9qajWUeraAtxe7GodkEFjqv33naAWXaj4mrUTF8AKHMm	user
\.


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: secureapp
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- Name: users users_login_key; Type: CONSTRAINT; Schema: public; Owner: secureapp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_login_key UNIQUE (login);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: secureapp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict X9FDxiifpqzHJMePnAPxvxqP4NPyBSQZhSMsYim9Kuq9j3DbJq9vmlau88pdXEr

