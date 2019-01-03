import { ObjectId } from 'bson';
import * as WebSocket from 'ws';
import { ICasData } from '../../users/ICasData';
import { IMemberBase } from './IMemberBase';
import { IMemberSerialized } from './IMemberSerialized';

export interface IMemberEntity extends IMemberBase {
  id?: ObjectId;
  casProfile: ICasData;
  webSocket?: WebSocket;

  serialize(): IMemberSerialized;

  addResponseValue(data: Array<number>): void;

  setConfidenceValue(confidenceValue: number): void;

  setReadingConfirmation(): void;

}