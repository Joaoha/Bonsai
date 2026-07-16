// Intentional boundary violation. Consumed only by `pnpm boundary:verify`.
// If ESLint stops flagging these imports, no-restricted-imports on packages/core is broken.

import * as React from 'react';
import { NextResponse } from 'next/server';
import pg from 'pg';
import postgres from 'postgres';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as http from 'node:http';
import axios from 'axios';
import OpenAI from 'openai';

export const violations = { React, NextResponse, pg, postgres, Database, fs, http, axios, OpenAI };
