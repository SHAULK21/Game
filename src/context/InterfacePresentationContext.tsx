import {createContext,useContext,type ComponentType} from 'react';
import type {CharacterClassId,Skill} from '../types/game';
export type RegistrationPresentation = {ClassPortrait?:ComponentType<{classId:CharacterClassId;className?:string}>;SkillCard?:ComponentType<{skill:Skill}>;heroArtwork?:(id:CharacterClassId)=>string};
export const InterfacePresentationContext = createContext<RegistrationPresentation>({});
export const useRegistrationPresentation = () => useContext(InterfacePresentationContext);
