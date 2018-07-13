import { IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import * as crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { default as DbDAO } from '../db/DbDAO';
import QuizManagerDAO from '../db/QuizManagerDAO';
import { DATABASE_TYPE } from '../Enums';

export class LegacyApiRouter {
  private _router: Router;

  get router(): Router {
    return this._router;
  }

  /**
   * Initialize the LegacyApiRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  private init(): void {
    this._router.get('/', this.getAll);
    this._router.post('/keepalive', this.setKeepalive);
    this._router.post('/addHashtag', this.addHashtag);
    this._router.get('/createPrivateKey', this.createPrivateKey);
    this._router.post('/removeLocalData', this.removeLocalData);
    this._router.post('/showReadingConfirmation', this.showReadingConfirmation);
    this._router.post('/openSession', this.openSession);
    this._router.post('/startNextQuestion', this.startNextQuestion);
    this._router.post('/updateQuestionGroup', this.updateQuestionGroup);
  }

  private getAll(req: Request, res: Response, next: NextFunction): void {
    res.json({});
  }

  private setKeepalive(req: Request, res: Response, next: NextFunction): void {
    res.send('Ok');
  }

  private addHashtag(req: Request, res: Response, next: NextFunction): void {
    const sessionConfiguration = req.body.sessionConfiguration;
    if (QuizManagerDAO.getPersistedQuizByName(sessionConfiguration.hashtag)) {
      res.sendStatus(500);
      res.end('Hashtag already in use');
      return;
    }
    QuizManagerDAO.initInactiveQuiz(sessionConfiguration.hashtag);
    DbDAO.create(DATABASE_TYPE.QUIZ, {
      quizName: sessionConfiguration.hashtag,
      privateKey: sessionConfiguration.privateKey,
    });
    res.send('Hashtag successfully created');
  }

  private dec2hex(dec): string {
    return (
      '0' + dec.toString(16)
    ).substr(-2);
  }

  private createPrivateKey(req: Request, res: Response, next: NextFunction): void {
    const privateKey = crypto.randomBytes(Math.ceil((
                                                      40
                                                    ) / 2))
    .toString('hex')
    .slice(0, 40);
    res.send(privateKey);
  }

  private removeLocalData(req: Request, res: Response, next: NextFunction): void {
    const sessionConfiguration = req.body.sessionConfiguration;
    if (!QuizManagerDAO.isActiveQuiz(sessionConfiguration.hashtag)) {
      res.sendStatus(500);
      res.end('Missing permissions.');
      return;
    }
    QuizManagerDAO.setQuizAsInactive(sessionConfiguration.hashtag);
    res.send('Session successfully removed');
  }

  private showReadingConfirmation(req: Request, res: Response, next: NextFunction): void {
    const sessionConfiguration = req.body.sessionConfiguration;
    const activeQuiz = QuizManagerDAO.getActiveQuizByName(sessionConfiguration.hashtag);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end('Hashtag not found');
      return;
    }
    activeQuiz.requestReadingConfirmation();
    res.sendStatus(200);
    res.end();
  }

  private openSession(req: Request, res: Response, next: NextFunction): void {
    const sessionConfiguration = req.body.sessionConfiguration;

    res.sendStatus(200);
    res.end();
    // TODO: Figure out how to combine req with /updateQuestionGroup request.
  }

  private startNextQuestion(req: Request, res: Response, next: NextFunction): void {
    const sessionConfiguration = req.body.sessionConfiguration;
    const activeQuiz = QuizManagerDAO.getActiveQuizByName(sessionConfiguration.hashtag);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end('Hashtag not found');
      return;
    }
    activeQuiz.nextQuestion();
    res.send(`Next Question with index ${sessionConfiguration.questionIndex} started.`);
  }

  private updateQuestionGroup(req: Request, res: Response, next: NextFunction): void {
    const questionGroup = <IQuestionGroup>req.body.questionGroupModel;
    if (!QuizManagerDAO.isInactiveQuiz(questionGroup.hashtag)) {
      res.sendStatus(500);
      res.end('Hashtag not found');
      return;
    }
    QuizManagerDAO.initActiveQuiz(questionGroup);
    res.send(`Session with hashtag ${questionGroup.hashtag} successfully updated`);
  }
}

// Create the LegacyApiRouter, and export its configured Express.Router
const legacyApiRoutes = new LegacyApiRouter();
const legacyApiRouter = legacyApiRoutes.router;
export { legacyApiRouter };
