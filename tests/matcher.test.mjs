import test from "node:test";
import assert from "node:assert/strict";
import { matchRules } from "../dist/engine/matcher.js";
const rule={id:"windows-1312",title:"Sandbox 1312",category:"sandbox",severity:"high",platforms:["windows"],match:{any:[{contains:"CreateProcessAsUserW failed: 1312"}],all:[]},summary:"summary",actions:["action"],links:[],tags:[],i18n:{}};
test("scores an exact platform-specific signature strongly",()=>{const matches=matchRules([rule],{platform:"windows",extraText:"windows sandbox: CreateProcessAsUserW failed: 1312"});assert.equal(matches.length,1);assert.ok(matches[0].confidence>=65);});
test("does not match another platform",()=>assert.equal(matchRules([rule],{platform:"linux",extraText:"CreateProcessAsUserW failed: 1312"}).length,0));
