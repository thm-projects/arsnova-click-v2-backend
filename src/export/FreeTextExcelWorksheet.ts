import MemberDAO from '../db/MemberDAO';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { IQuestionFreetext } from '../interfaces/questions/IQuestionFreetext';
import { asyncForEach } from '../lib/async-for-each';
import { MemberModelItem } from '../models/member/MemberModel';
import { ExcelWorksheet } from './ExcelWorksheet';

export class FreeTextExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private _isCasRequired = this.quiz.sessionConfig.nicks.restrictToCasLogin;
  private _question: IQuestionFreetext;
  private readonly _questionIndex: number;
  private allResponses: Array<MemberModelItem> = [];

  constructor({ wb, theme, translation, quiz, mf, questionIndex }) {
    super({
      theme,
      translation,
      quiz,
      mf,
      questionIndex,
    });
    this._ws = wb.addWorksheet(`${mf('export.question')} ${questionIndex + 1}`, this._options);
    this._questionIndex = questionIndex;
    this._question = this.quiz.questionList[questionIndex] as IQuestionFreetext;

    MemberDAO.getMembersOfQuizForOwner(this.quiz.name).then(members => this.allResponses = members.filter(nickname => {
      return nickname.responses.find(response => {
        return !!response.value && response.value !== -1 ? response.value : null;
      });
    }));

    this.loaded.on('load', () => Promise.all([
      this.formatSheet(), this.addSheetData(),
    ]).then(() => this.renderingFinished.emit('done')));
  }

  public async formatSheet(): Promise<void> {
    const defaultStyles = this._theme.getStyles();
    let minColums = 3;
    if (this.responsesWithConfidenceValue.length > 0) {
      minColums++;
    }
    if (this._isCasRequired) {
      minColums += 2;
    }
    const columnsToFormat = 4 < minColums ? minColums : 4;

    this.ws.row(1).setHeight(20);
    this.ws.column(1).setWidth(this.responsesWithConfidenceValue.length > 0 ? 40 : 30);
    this.ws.column(2).setWidth(30);
    this.ws.column(3).setWidth(45);
    this.ws.column(4).setWidth(35);

    this.ws.cell(1, 1, 1, columnsToFormat).style(defaultStyles.quizNameRowStyle);
    this.ws.cell(2, 1, 2, columnsToFormat).style(defaultStyles.exportedAtRowStyle);
    this.ws.cell(2, 2, 2, columnsToFormat).style({
      alignment: {
        horizontal: 'center',
      },
    });

    this.ws.cell(4, 1).style({
      alignment: {
        wrapText: true,
        vertical: 'top',
      },
    });
    this.ws.cell(4, 2).style({
      alignment: {
        wrapText: true,
        horizontal: 'center',
        vertical: 'center',
      },
      font: {
        color: 'FF000000',
      },
    });

    this.ws.cell(6, 1, this.responsesWithConfidenceValue.length > 0 ? 8 : 7, columnsToFormat).style(defaultStyles.statisticsRowStyle);
    this.ws.cell(6, 2, this.responsesWithConfidenceValue.length > 0 ? 8 : 7, 2).style({
      alignment: {
        horizontal: 'center',
      },
    });

    this.ws.cell(10, 1, 10, columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
    this.ws.cell(10, 1).style({
      alignment: {
        horizontal: 'left',
      },
    });

    this.ws.row(10).filter({
      firstRow: 10,
      firstColumn: 1,
      lastRow: 10,
      lastColumn: minColums,
    });

    const hasEntries = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length > 0;
    const attendeeEntryRows = hasEntries ? ((await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length) : 1;
    const attendeeEntryRowStyle = hasEntries ? defaultStyles.attendeeEntryRowStyle : Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
      alignment: {
        horizontal: 'center',
      },
    });
    this.ws.cell(11, 1, attendeeEntryRows + 10, columnsToFormat, !hasEntries).style(attendeeEntryRowStyle);

    await asyncForEach(this.allResponses, async (responseItem, indexInList) => {
      const leaderboardItem = (await this.getLeaderboardData()).filter(lbItem => lbItem.name === responseItem.name)[0];
      let nextColumnIndex = 2;
      const targetRow = indexInList + 11;
      if (this._isCasRequired) {
        nextColumnIndex += 2;
      }
      this.ws.cell(targetRow, nextColumnIndex++).style({
        font: {
          color: 'FFFFFFFF',
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: leaderboardItem && leaderboardItem.correctQuestions.indexOf(this._questionIndex) > -1 ? 'FF008000' : 'FFB22222',
        },
      });
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(targetRow, nextColumnIndex++).style({
          alignment: {
            horizontal: 'center',
          },
        });
      }
      this.ws.cell(targetRow, nextColumnIndex).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: defaultStyles.numberFormat,
      });
    });
  }

  public async addSheetData(): Promise<void> {
    const answerOption = this._question.answerOptionList[0];

    this.ws.cell(1, 1).string(`${this.mf('export.question_type')}: ${this.mf(`export.type.${this._question.TYPE}`)}`);
    this.ws.cell(2, 1).string(this.mf('export.question'));
    this.ws.cell(2, 2).string(this.mf('export.correct_value'));

    this.ws.cell(4, 1).string(this._question.questionText.replace(/[#]*[*]*/g, ''));
    this.ws.cell(4, 2).string(answerOption.answerText);

    this.ws.cell(6, 1).string(this.mf('export.number_of_answers') + ':');
    this.ws.cell(6, 2).number(this.allResponses.length);

    this.ws.cell(6, 3).string(`
      ${this.mf('view.answeroptions.free_text_question.config_case_sensitive')}:
       ${this.mf(answerOption.configCaseSensitive ? 'global.yes' : 'global.no')}`);
    this.ws.cell(6, 4).string(`
      ${this.mf('view.answeroptions.free_text_question.config_trim_whitespaces')}:
       ${this.mf(answerOption.configTrimWhitespaces ? 'global.yes' : 'global.no')}`);

    this.ws.cell(7, 1).string(this.mf('export.percent_correct') + ':');
    const correctResponsesPercentage: number = (await this.getLeaderboardData()).map(leaderboard => leaderboard.correctQuestions)
                                               .filter(correctQuestions => correctQuestions.includes(this._questionIndex)).length
                                               / (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length * 100;
    this.ws.cell(7, 2).number((isNaN(correctResponsesPercentage) ? 0 : Math.round(correctResponsesPercentage)));

    this.ws.cell(7, 3).string(`
      ${this.mf('view.answeroptions.free_text_question.config_use_keywords')}:
       ${this.mf(answerOption.configUseKeywords ? 'global.yes' : 'global.no')}`);
    this.ws.cell(7, 4).string(`
      ${this.mf('view.answeroptions.free_text_question.config_use_punctuation')}:
       ${this.mf(answerOption.configUsePunctuation ? 'global.yes' : 'global.no')}`);

    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(8, 1).string(this.mf('export.average_confidence') + ':');
      let confidenceSummary = 0;
      (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).forEach((nickItem) => {
        confidenceSummary += nickItem.responses[this._questionIndex].confidence;
      });
      this.ws.cell(8, 2).number(Math.round(confidenceSummary / this.responsesWithConfidenceValue.length));
    }

    let nextColumnIndex = 1;
    this.ws.cell(10, nextColumnIndex++).string(this.mf('export.attendee'));
    if (this._isCasRequired) {
      this.ws.cell(10, nextColumnIndex++).string(this.mf('export.cas_account_id'));
      this.ws.cell(10, nextColumnIndex++).string(this.mf('export.cas_account_email'));
    }
    this.ws.cell(10, nextColumnIndex++).string(this.mf('export.answer'));
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(10, nextColumnIndex++).string(this.mf('export.confidence_level'));
    }
    this.ws.cell(10, nextColumnIndex++).string(this.mf('export.time'));

    let nextStartRow = 10;
    this.allResponses.forEach((nickItem) => {
      nextColumnIndex = 1;
      nextStartRow++;
      this.ws.cell(nextStartRow, nextColumnIndex++).string(nickItem.name);
      if (this._isCasRequired) {
        const profile = nickItem.casProfile;
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.mail[0]);
      }
      this.ws.cell(nextStartRow, nextColumnIndex++).string(nickItem.responses[this._questionIndex].value);
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(Math.round(nickItem.responses[this._questionIndex].confidence));
      }
      const responseTime = this.formatMillisToSeconds(nickItem.responses[this._questionIndex].responseTime);
      if (responseTime) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(responseTime);
      } else {
        this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.no_answer'));
      }
    });
    if (nextStartRow === 10) {
      this.ws.cell(11, 1).string(this.mf('export.attendee_complete_correct_none_available'));
    }
  }
}
