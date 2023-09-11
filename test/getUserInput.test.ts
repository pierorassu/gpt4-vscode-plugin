import { getUserInput } from '../src/extension';
import * as vscode from 'vscode'; // Import the 'vscode' module

// Mock the vscode module
jest.mock('vscode', () => {
    return {
      window: {
        showInputBox: jest.fn(),
      },
    };
  });

describe('getUserInput Function Tests', () => {
  test('Test Case 1: Parsing input with new|<swap.py>swap 2 strings in python', async () => {
    const result = await getUserInput();

    expect(result).toEqual({ command: '', fileName: '', prompt: '' });
  });
});

describe('getUserInput Function Tests', () => {
    test('Test Case 2: Parsing input with new|<swap.py>swap 2 strings in python', async () => {
      // Set up the mock to return custom input
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('new|<swap.py>swap 2 strings in python');
  
      const result = await getUserInput();
  
      expect(result).toEqual({ command: 'new', fileName: 'swap.py', prompt: 'swap 2 strings in python' });
    });
  });

// COMMAND|<FILENAME>|FREE_TEXT, COMMAND|FREE_TEXT, <FILENAME>|FREE_TEXT, or just FREE_TEXT

describe('getUserInput Function Tests', () => {
    test('Test Case 3: Parsing input with new|swap 2 strings in python', async () => {
      // Set up the mock to return custom input
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('new|swap 2 strings in python');
  
      const result = await getUserInput();
  
      expect(result).toEqual({ command: 'new', fileName: '', prompt: 'swap 2 strings in python' });
      });      
});

describe('getUserInput Function Tests', () => {
    test('Test Case 4: Parsing input with <swap.py>|swap 2 strings in python', async () => {
        // Set up the mock to return custom input
        (vscode.window.showInputBox as jest.Mock).mockResolvedValue('<swap.py>swap 2 strings in python');

        const result = await getUserInput();

        expect(result).toEqual({ command: 'new', fileName: 'swap.py', prompt: 'swap 2 strings in python' });
    });
});

describe('getUserInput Function Tests', () => {
    test('Test Case 5: Parsing input with swap 2 strings in python', async () => {
        // Set up the mock to return custom input
        (vscode.window.showInputBox as jest.Mock).mockResolvedValue('swap 2 strings in python');

        const result = await getUserInput();

        expect(result).toEqual({ command: 'new', fileName: '', prompt: 'swap 2 strings in python' });
    });
});
