import { createAction } from '@reduxjs/toolkit';
import {
  GeneratorProgressEvent,
  GraphExecutionStateCompleteEvent,
  InvocationCompleteEvent,
  InvocationErrorEvent,
  InvocationStartedEvent,
} from 'services/events/types';

// Common socket action payload data
type BaseSocketPayload = {
  timestamp: string;
};

// Create actions for each socket event
// Middleware and redux can then respond to them as needed

export const socketConnected = createAction<BaseSocketPayload>(
  'socket/socketConnected'
);

export const socketDisconnected = createAction<BaseSocketPayload>(
  'socket/socketDisconnected'
);

export const socketSubscribed = createAction<
  BaseSocketPayload & { sessionId: string }
>('socket/socketSubscribed');

export const socketUnsubscribed = createAction<
  BaseSocketPayload & { sessionId: string }
>('socket/socketUnsubscribed');

export const invocationStarted = createAction<
  BaseSocketPayload & { data: InvocationStartedEvent }
>('socket/invocationStarted');

export const invocationComplete = createAction<
  BaseSocketPayload & {
    data: InvocationCompleteEvent;
  }
>('socket/invocationComplete');

export const invocationError = createAction<
  BaseSocketPayload & { data: InvocationErrorEvent }
>('socket/invocationError');

export const graphExecutionStateComplete = createAction<
  BaseSocketPayload & { data: GraphExecutionStateCompleteEvent }
>('socket/graphExecutionStateComplete');

export const generatorProgress = createAction<
  BaseSocketPayload & { data: GeneratorProgressEvent }
>('socket/generatorProgress');

// dispatch this when we need to fully reset the socket connection
export const socketReset = createAction('socket/socketReset');
