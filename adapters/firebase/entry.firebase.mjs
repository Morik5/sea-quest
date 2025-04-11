import { createQwikCity } from '@builder.io/qwik-city/middleware/firebase';
import qwikCityPlan from '@qwik-city-plan';
import { manifest } from '@qwik-city-manifest';
import render from './entry.ssr';

export const app = createQwikCity({ render, qwikCityPlan, manifest });