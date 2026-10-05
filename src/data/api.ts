import type {FleetAircraft,ParkedAircraft,CalendarEvent,Airport,Opportunity,Signal,AgentState,EmptyLegInput,EmptyLegResult,MarketLeg,MemoryItem,ParsedRequest,DecisionPolicyRow,MyTrip,RouteWx} from './types';
export interface EyeApi{
 listAirports():Promise<Airport[]>;listSignals():Promise<Signal[]>;listOpportunities():Promise<Opportunity[]>;
 approveOpportunity(id:string):Promise<void>;rejectOpportunity(id:string,reason:string):Promise<void>;
 analyzeEmptyLeg(i:EmptyLegInput,onStep:(s:string)=>void):Promise<EmptyLegResult>;listMarket():Promise<MarketLeg[]>;
 parseRequest(text:string):Promise<ParsedRequest>;listMemory():Promise<MemoryItem[]>;saveMemory(key:string,value:string):Promise<void>;
 listPolicy():Promise<DecisionPolicyRow[]>;
 routeWeather(origin:string,destination:string):Promise<RouteWx[]>;listMyTrips():Promise<MyTrip[]>;addMyTrip(origin:string,destination:string,departureAt:string|null):Promise<void>;removeMyTrip(id:string):Promise<void>;
 runPass(onState:(s:AgentState)=>void):Promise<string>;
 fleetReport(regs:string[],consent:boolean):Promise<FleetAircraft[]>;parkedAircraft(regs?:string[]):Promise<ParkedAircraft[]>;demandCalendar(days:number):Promise<CalendarEvent[]>;
}
import {mockApi} from './mockApi';
import {realApi} from './supabaseApi';
export let api:EyeApi=mockApi;
export const useRealApi=()=>{api=realApi};
