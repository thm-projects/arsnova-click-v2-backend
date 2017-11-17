import {Router, Request, Response, NextFunction} from 'express';
import {IActiveQuiz, INickname} from 'arsnova-click-v2-types/src/common';
import {QuizManagerDAO} from '../db/QuizManagerDAO';
import {CasDAO} from '../db/CasDAO';

export class MemberRouter {
  get router(): Router {
    return this._router;
  }

  private _router: Router;

  /**
   * Initialize the MemberRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  private getAll(req: Request, res: Response, next: NextFunction): void {
    res.json({});
  }

  public addMember(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:ADD_MEMBER:QUIZ_INACTIVE',
        payload: {}
      }));
      return;
    }
    if (!req.body.nickname || (activeQuiz.originalObject.sessionConfig.nicks.restrictToCasLogin && !req.body.ticket)) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:ADD_MEMBER:INVALID_PARAMETERS',
        payload: {}
      }));
      return;
    }
    try {
      const webSocketAuthorization: number = Math.random();
      activeQuiz.addMember(req.body.nickname, webSocketAuthorization, req.body.ticket);
      res.send({
        status: 'STATUS:SUCCESSFUL',
        step: 'LOBBY:MEMBER_ADDED',
        payload: {
          member: activeQuiz.nicknames[activeQuiz.nicknames.length - 1].serialize(),
          nicknames: activeQuiz.nicknames.map((value: INickname) => {
            return value.serialize();
          }),
          sessionConfiguration: activeQuiz.originalObject.sessionConfig,
          webSocketAuthorization: webSocketAuthorization
        }
      });
    } catch (ex) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'LOBBY:MEMBER_ADDED',
        payload: {message: ex.message}
      }));
    }
  }

  public addReadingConfirmation(req: Request, res: Response): void {
    const activeQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:ADD_READING_CONFIRMATION:QUIZ_INACTIVE',
        payload: {}
      }));
      return;
    }
    activeQuiz.setReadingConfirmation(req.body.nickname);
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:ADD_READING_CONFIRMATION',
      payload: {}
    });
  }

  public addConfidenceValue(req: Request, res: Response): void {
    const activeQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:ADD_CONFIDENCE_VALUE:QUIZ_INACTIVE',
        payload: {}
      }));
      return;
    }
    activeQuiz.setConfidenceValue(req.body.nickname, req.body.confidenceValue);
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:ADD_CONFIDENCE_VALUE',
      payload: {}
    });
  }

  public deleteMember(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:REMOVE_MEMBER:QUIZ_INACTIVE',
        payload: {}
      }));
      return;
    }
    const result: boolean = activeQuiz ? activeQuiz.removeMember(req.params.nickname) : false;
    const response: Object = {status: `STATUS:${result ? 'SUCCESSFUL' : 'FAILED'}`};
    if (result) {
      Object.assign(response, {
        step: 'LOBBY:MEMBER_REMOVED',
        payload: {}
      });
    }
    res.send(response);
  }

  public getAllMembers(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:GET_MEMBERS:QUIZ_INACTIVE',
        payload: {}
      }));
      return;
    }
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:GET_MEMBERS',
      payload: {
        nicknames: activeQuiz.nicknames.map((value: INickname) => {
          return value.serialize();
        })
      }
    });
  }

  public getRemainingNicks(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:GET_REMAINING_NICKS:QUIZ_INACTIVE',
        payload: {}
      }));
      return;
    }
    const names: Array<String> = activeQuiz.originalObject.sessionConfig.nicks.selectedNicks.filter((nick) => {
      return activeQuiz.nicknames.filter(value => value.name === nick).length === 0;
    });
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:GET_REMAINING_NICKS',
      payload: {nicknames: names}
    });
  }

  public addResponse(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:ADD_MEMBER_RESPONSE:QUIZ_INACTIVE',
        payload: {}
      }));
      return;
    }
    if (activeQuiz.nicknames.filter(value => {
        return value.name === req.body.nickname;
      })[0].responses[activeQuiz.currentQuestionIndex].responseTime) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:DUPLICATE_MEMBER_RESPONSE',
        payload: {}
      }));
      return;
    }

    if (typeof req.body.value === 'undefined') {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_MEMBER_RESPONSE',
        payload: {}
      }));
      return;
    }

    activeQuiz.addResponseValue(req.body.nickname, req.body.value);

    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:ADD_MEMBER_RESPONSE',
      payload: {}
    });
  }

  public init(): void {
    this._router.get('/', this.getAll);

    this._router.get('/:quizName', this.getAllMembers);
    this._router.get('/:quizName/available', this.getRemainingNicks);

    this._router.put('/', this.addMember);
    this._router.put('/reading-confirmation', this.addReadingConfirmation);
    this._router.put('/confidence-value', this.addConfidenceValue);
    this._router.put('/response', this.addResponse);

    this._router.delete('/:quizName/:nickname', this.deleteMember);

  }
}

// Create the ApiRouter, and export its configured Express.Router
const memberRoutes: MemberRouter = new MemberRouter();

export default memberRoutes.router;
