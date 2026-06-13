import 'zone.js';
import 'zone.js/testing';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

import './app/meal-prep/meal-prep.service.spec';
import './app/volunteer-delivery/volunteer-delivery.service.spec';
import './app/closure-dashboard/closure-dashboard.service.spec';
