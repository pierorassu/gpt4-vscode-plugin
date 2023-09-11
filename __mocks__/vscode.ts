const vscode = {
  window: {
    showInputBox: jest.fn((options) => {
      // You can use options to determine the behavior of your mock
      return Promise.resolve(options?.value || ''); // Return the value provided in options or an empty string
    }),
  },
};

export = vscode;
