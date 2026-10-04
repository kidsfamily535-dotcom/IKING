import type {Airport,Opportunity,Signal,AgentState,EmptyLegInput,EmptyLegResult,MarketLeg,MemoryItem,ParsedRequest,DecisionPolicyRow} from './types';
export interface EyeApi{
 listAirports():Promise<Airport[]>;listSignals():Promise<Signal[]>;listOpportunities():Promise<Opportunity[]>;
 approveOpportunity(id:string):Promise<void>;rejectOpportunity(id:string,reason:string):Promise<void>;
 analyzeEmptyLeg(i:EmptyLegInput,onStep:(s:string)=>void):Promise<EmptyLegResult>;listMarket():Promise<MarketLeg[]>;
 parseRequest(text:string):Promise<ParsedRequest>;listMemory():Promise<MemoryItem[]>;saveMemory(key:string,value:string):Promise<void>;
 listPolicy():Promise<DecisionPolicyRow[]>;
 runPass(onState:(s:AgentState)=>void):Promise<string>;
}
import {mockApi} from './mockApi';
import {realApi} from './supabaseApi';
export let api:EyeApi=mockApi;
export const useRealApi=()=>{api=realApi};
