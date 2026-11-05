import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationPayload } from './notification.mjs';

test('notifications include the complete inquiry and replies go to the visitor',()=>{
 const inquiry={name:'Alex Test',email:'visitor@example.invalid',package:'Team',message:'Friday at 7?\nLocation: Surrey\nThanks!'};
 const message=notificationPayload(inquiry,{sender:'sender@example.invalid',recipient:'owner@example.invalid',site:'https://photos.example.invalid/'});
 assert.deepEqual(message.to,[{email:'owner@example.invalid'}]);
 assert.deepEqual(message.replyTo,{email:'visitor@example.invalid'});
 for(const value of [inquiry.name,inquiry.email,inquiry.package,inquiry.message])assert.ok(message.textContent.includes(value));
 assert.ok(message.textContent.includes('https://photos.example.invalid/admin/'));
});

test('an inquiry without a package says it was not specified',()=>{
 const message=notificationPayload({name:'A',email:'a@example.invalid',package:'',message:'Hello'}, {sender:'sender@example.invalid',recipient:'owner@example.invalid',site:'https://photos.example.invalid'});
 assert.ok(message.textContent.includes('Package: Not specified'));
});
