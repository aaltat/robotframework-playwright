// Copyright 2020-     Robot Framework Foundation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Dialog, FileChooser, Page } from 'playwright';
import { ServerUnaryCall, sendUnaryData } from 'grpc';

import { PlaywrightState } from './playwright-state';
import { Request, Response } from './generated/playwright_pb';
import { emptyWithLog } from './response-util';
import { invokeOnKeyboard, invokeOnMouse, invokeOnPage, invokePlaywrightMethod } from './playwirght-invoke';

import * as pino from 'pino';
const logger = pino.default({ timestamp: pino.stdTimeFunctions.isoTime });

export async function selectOption(
    request: Request.SelectElementSelector,
    state: PlaywrightState,
): Promise<Response.Empty> {
    const selector = request.getSelector();
    const matcher = JSON.parse(request.getMatcherjson());
    const result = await invokePlaywrightMethod(state, 'selectOption', selector, matcher);

    if (result.length == 0) {
        logger.info("Couldn't select any options");
        throw new Error(`No options matched ${matcher}`);
    }
    return emptyWithLog(`Selected options ${result} in element ${selector}`);
}

export async function deSelectOption(
    request: Request.ElementSelector,
    state: PlaywrightState,
): Promise<Response.Empty> {
    const selector = request.getSelector();
    await invokePlaywrightMethod(state, 'selectOption', selector, []);
    return emptyWithLog(`Deselected options in element ${selector}`);
}

export async function inputText(request: Request.TextInput, state: PlaywrightState): Promise<Response.Empty> {
    const inputText = request.getInput();
    const selector = request.getSelector();
    const type = request.getType();
    const methodName = type ? 'type' : 'fill';
    await invokePlaywrightMethod(state, methodName, selector, inputText);
    return emptyWithLog('Input text: ' + inputText);
}

export async function typeText(request: Request.TypeText, state: PlaywrightState): Promise<Response.Empty> {
    const selector = request.getSelector();
    const text = request.getText();
    const delay = request.getDelay();
    const clear = request.getClear();
    if (clear) {
        await invokePlaywrightMethod(state, 'fill', selector, '');
    }
    await invokePlaywrightMethod(state, 'type', selector, text, { delay: delay });
    return emptyWithLog('Typed text: ' + text);
}

export async function fillText(request: Request.FillText, state: PlaywrightState): Promise<Response.Empty> {
    const selector = request.getSelector();
    const text = request.getText();
    await invokePlaywrightMethod(state, 'fill', selector, text);
    return emptyWithLog('Fill text: ' + text);
}

export async function clearText(request: Request.ClearText, state: PlaywrightState): Promise<Response.Empty> {
    const selector = request.getSelector();
    await invokePlaywrightMethod(state, 'fill', selector, '');
    return emptyWithLog('Text field cleared.');
}

export async function press(request: Request.PressKeys, state: PlaywrightState): Promise<Response.Empty> {
    const selector = request.getSelector();
    const keyList = request.getKeyList();
    for (const i of keyList) {
        await invokePlaywrightMethod(state, 'press', selector, i);
    }
    return emptyWithLog('Pressed keys: ' + keyList);
}

export async function click(
    request: Request.ElementSelectorWithOptions,
    state: PlaywrightState,
): Promise<Response.Empty> {
    const selector = request.getSelector();
    const options = request.getOptions();
    await invokePlaywrightMethod(state, 'click', selector, JSON.parse(options));
    return emptyWithLog(`Clicked element: '${selector}' with options: '${options}'`);
}

export async function hover(
    request: Request.ElementSelectorWithOptions,
    state: PlaywrightState,
): Promise<Response.Empty> {
    const selector = request.getSelector();
    const options = request.getOptions();
    await invokePlaywrightMethod(state, 'hover', selector, JSON.parse(options));
    return emptyWithLog(`Hovered element: '${selector}' With options: '${options}'`);
}

export async function focus(request: Request.ElementSelector, state: PlaywrightState): Promise<Response.Empty> {
    const selector = request.getSelector();
    await invokePlaywrightMethod(state, 'focus', selector);
    return emptyWithLog('Focused element: ' + selector);
}

export async function checkCheckbox(request: Request.ElementSelector, state: PlaywrightState): Promise<Response.Empty> {
    const selector = request.getSelector();
    await invokePlaywrightMethod(state, 'check', selector);
    return emptyWithLog('Checked checkbox: ' + selector);
}

export async function uncheckCheckbox(
    request: Request.ElementSelector,
    state: PlaywrightState,
): Promise<Response.Empty> {
    const selector = request.getSelector();
    await invokePlaywrightMethod(state, 'uncheck', selector);
    return emptyWithLog('Unchecked checkbox: ' + selector);
}

export async function uploadFile(
    call: ServerUnaryCall<Request.FilePath>,
    callback: sendUnaryData<Response.Empty>,
    page?: Page,
) {
    const path = call.request.getPath();
    const fn = async (fileChooser: FileChooser) => await fileChooser.setFiles(path);
    await invokeOnPage(page, 'on', 'filechooser', fn);
    callback(null, emptyWithLog('Succesfully uploaded file'));
}

export async function handleAlert(
    call: ServerUnaryCall<Request.AlertAction>,
    callback: sendUnaryData<Response.Empty>,
    page?: Page,
) {
    const alertAction = call.request.getAlertaction() as 'accept' | 'dismiss';
    const promptInput = call.request.getPromptinput();
    const fn = async (dialog: Dialog) => {
        if (promptInput) await dialog[alertAction](promptInput);
        else await dialog[alertAction]();
    };
    await invokeOnPage(page, 'on', 'dialog', fn);
    callback(null, emptyWithLog('Set event handler for next alert'));
}

export async function mouseButton(
    call: ServerUnaryCall<Request.MouseButtonOptions>,
    callback: sendUnaryData<Response.Empty>,
    page?: Page,
): Promise<void> {
    const action = call.request.getAction() as 'click' | 'up' | 'down';
    const params = JSON.parse(call.request.getJson());
    await invokeOnMouse(page, action, params);
    callback(null, emptyWithLog(`Succesfully executed ${action}`));
}

export async function mouseMove(
    call: ServerUnaryCall<Request.Json>,
    callback: sendUnaryData<Response.Empty>,
    page?: Page,
): Promise<void> {
    const params = JSON.parse(call.request.getBody());
    await invokeOnMouse(page, 'move', params);
    callback(null, emptyWithLog(`Succesfully moved mouse to ${params.x}, ${params.y}`));
}
export async function keyboardKey(
    call: ServerUnaryCall<Request.KeyboardKeypress>,
    callback: sendUnaryData<Response.Empty>,
    page?: Page,
): Promise<void> {
    const action = call.request.getAction() as 'down' | 'up' | 'press';
    const key = call.request.getKey();
    await invokeOnKeyboard(page, action, key);
    callback(null, emptyWithLog(`Succesfully did ${action} for ${key}`));
}

export async function keyboardInput(
    call: ServerUnaryCall<Request.KeyboardInputOptions>,
    callback: sendUnaryData<Response.Empty>,
    page?: Page,
): Promise<void> {
    const action = call.request.getAction() as 'insertText' | 'type';
    const delay = call.request.getDelay();
    const input = call.request.getInput();

    await invokeOnKeyboard(page, action, input, { delay: delay });
    callback(null, emptyWithLog(`Succesfully did virtual keyboard action ${action} with input ${input}`));
}
