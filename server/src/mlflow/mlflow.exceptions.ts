import { HttpException, HttpStatus } from '@nestjs/common';

export class PromptRegistryUnavailableException extends HttpException {
  constructor(message = 'MLflow prompt registry is unavailable') {
    super(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class FlowNotRegisteredException extends HttpException {
  constructor(flowKey: string) {
    super(`Flow not registered: ${flowKey}`, HttpStatus.NOT_FOUND);
  }
}

export class PromptVariableException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
