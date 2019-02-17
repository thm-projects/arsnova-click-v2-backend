import * as path from 'path';
import MemberDAO from '../db/MemberDAO';
import { QuestionType } from '../enums/QuestionType';
import { IMemberEntity } from '../interfaces/entities/Member/IMemberEntity';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { ILeaderBoardItemBase } from '../interfaces/leaderboard/ILeaderBoardItemBase';
import { Leaderboard } from '../lib/leaderboard/leaderboard';
import { staticStatistics } from '../statistics';
import { ExcelWorksheet } from './ExcelWorksheet';

declare global {
  namespace xlsx {
    // noinspection TsLint
    interface Row {
      filter(config: object): void;

      setHeight(height: number): void;

      setWidth(width: number): void;
    }

    // noinspection TsLint
    interface Worksheet {
      cell: Function;
      addImage: Function;

      row(index: number): Row;
    }

    class Workbook {
      constructor(config: object);
    }

    // noinspection TsLint
    interface Workbook {
      addWorksheet: Function;
    }
  }
}

export class SummaryExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private _isCasRequired = this.quiz.sessionConfig.nicks.restrictToCasLogin;

  constructor({ wb, theme, translation, quiz, mf }) {
    super({
      theme,
      translation,
      quiz,
      mf,
      questionIndex: null,
    });
    this._ws = wb.addWorksheet(mf('export.summary'), this._options);
    this.formatSheet();
    this.addSheetData();
  }

  public formatSheet(): void {
    const defaultStyles = this._theme.getStyles();

    this.ws.row(1).setHeight(20);
    this.ws.column(1).setWidth(30);
    this.ws.column(2).setWidth(this._isCasRequired ? 10 : 20);
    for (let i = 3; i <= this.columnsToFormat; i++) {
      this.ws.column(i).setWidth(22);
    }

    this.ws.cell(1, 1, 1, this.columnsToFormat).style(Object.assign({}, defaultStyles.quizNameRowStyle, {
      alignment: {
        vertical: 'center',
      },
    }));
    this.ws.cell(1, this.columnsToFormat - 1).style({
      alignment: {
        horizontal: 'left',
        vertical: 'center',
      },
    });

    this.ws.cell(2, 1, 2, this.columnsToFormat).style(defaultStyles.exportedAtRowStyle);

    this.ws.cell(1, 1, 2, 1).style({
      alignment: {
        indent: 7,
      },
    });

    this.ws.cell(4, 1, 8, this.columnsToFormat).style(defaultStyles.statisticsRowStyle);
    this.ws.cell(4, 3, 8, 3).style({
      alignment: {
        horizontal: 'left',
      },
    });
    this.ws.cell(8, 3).style({
      numberFormat: '#,##0',
    });

    this.ws.cell(10, 1, 11, this.columnsToFormat).style(defaultStyles.attendeeHeaderGroupRowStyle);
    this.ws.cell(12, 1, 12, this.columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
    this.ws.cell(12, 1).style({
      alignment: {
        horizontal: 'left',
      },
    });

    this.ws.row(12).filter({
      firstRow: 12,
      firstColumn: 1,
      lastRow: 12,
      lastColumn: this.columnsToFormat,
    });

    let nextStartRow = 18;
    let dataWithoutCompleteCorrectQuestions = 0;
    this.leaderBoardData.forEach((leaderboardItem, indexInList) => {
      let hasNotAllQuestionsCorrect = false;
      this.quiz.questionList.forEach((item, index) => {
        if ([
              QuestionType.SurveyQuestion, QuestionType.ABCDSingleChoiceQuestion,
            ].includes(item.TYPE) && leaderboardItem.correctQuestions.indexOf((index)) === -1) {
          hasNotAllQuestionsCorrect = true;
        }
      });
      if (hasNotAllQuestionsCorrect) {
        dataWithoutCompleteCorrectQuestions++;
        return;
      }
      let nextColumnIndex = 3;
      nextStartRow++;
      const targetRow = indexInList + 13;
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(targetRow, nextColumnIndex++).style({
          alignment: {
            horizontal: 'center',
          },
        });
      }
      this.ws.cell(targetRow, nextColumnIndex++).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: '#,##0;',
      });
      this.ws.cell(targetRow, nextColumnIndex).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: '#,##0;',
      });
    });
    if (nextStartRow === 18) {
      this.ws.cell(13, 1, 13, this.columnsToFormat, true).style(Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
        alignment: {
          horizontal: 'center',
        },
      }));
      nextStartRow++;
    } else {
      this.ws.cell(13, 1, (this.leaderBoardData.length + 12 - dataWithoutCompleteCorrectQuestions), this.columnsToFormat)
      .style(defaultStyles.attendeeEntryRowStyle);
    }

    this.ws.cell(nextStartRow++, 1, nextStartRow++, this.columnsToFormat).style(defaultStyles.attendeeHeaderGroupRowStyle);

    this.ws.cell(nextStartRow, 1, nextStartRow, this.columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
    this.ws.cell(nextStartRow, 1).style({
      alignment: {
        horizontal: 'left',
      },
    });
    nextStartRow++;

    this.ws.cell(nextStartRow, 1, (this.leaderBoardData.length + (nextStartRow - 1)), this.columnsToFormat)
    .style(defaultStyles.attendeeEntryRowStyle);

    this.leaderBoardData.forEach((leaderboardItem, indexInList) => {
      let nextColumnIndex = 3;
      const targetRow = indexInList + nextStartRow;
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(targetRow, nextColumnIndex++).style({
          alignment: {
            horizontal: 'center',
          },
        });
      }
      this.ws.cell(targetRow, nextColumnIndex++).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: '#,##0;',
      });
      this.ws.cell(targetRow, nextColumnIndex).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: '#,##0;',
      });
    });
  }

  public addSheetData(): void {
    let currentRowIndex = 1;
    const numberOfResponses = MemberDAO.getMembersOfQuiz(this.quiz.name).filter(nickname => {
      return nickname.responses.filter(response => {
        return !!response.value && response.value !== -1;
      }).length;
    }).length;
    const allResponses: Array<IMemberEntity> = MemberDAO.getMembersOfQuiz(this.quiz.name);
    const numberOfAttendees = this.quiz.memberGroups[0].members.length;
    const numberOfQuestions = this.quiz.questionList.length;

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.quiz_name')}: ${this.quiz.name}`);

    this.ws.cell(currentRowIndex, this.columnsToFormat - 1).string(`${this.mf('export.session_content')}`);
    currentRowIndex++;

    this.ws.cell(currentRowIndex, 1).string(this.createdAt);
    this.ws.cell(currentRowIndex, this.columnsToFormat - 1, currentRowIndex, this.columnsToFormat, true)
    .string(JSON.stringify(this.quiz.serialize()));
    currentRowIndex += 2;

    this.addLogoImage();

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.number_attendees')}:`);
    this.ws.cell(currentRowIndex, 3).number(this.quiz.memberGroups[0].members.length);
    currentRowIndex++;

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.average_number_attendees_participated')}:`);
    this.ws.cell(currentRowIndex, 3).number(Math.round((numberOfResponses / numberOfAttendees / numberOfQuestions) * 100) || 0);
    currentRowIndex++;

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.average_correct_answered_questions')}:`);
    this.ws.cell(currentRowIndex, 3).number((this.leaderBoardData.map((x) => {
      return x.correctQuestions.length;
    }).reduce((a, b) => {
      return a + b;
    }, 0) / numberOfAttendees) || 0);
    currentRowIndex++;

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.average_confidence')}:`);
    const averageConfidencePercentage = (this.leaderBoardData.filter((x) => {
      return x.confidenceValue > -1;
    }).map((x) => {
      return x.confidenceValue;
    }).reduce((a, b) => {
      return a + b;
    }, 0) / numberOfAttendees);
    this.ws.cell(currentRowIndex, 3).number((isNaN(averageConfidencePercentage) ? 0 : Math.round(averageConfidencePercentage)));
    currentRowIndex++;

    this.ws.cell(currentRowIndex, 1).string(`${this.mf('export.average_response_time')}:`);
    this.ws.cell(currentRowIndex, 3).number((Math.round((this.leaderBoardData.map((x) => {
      return x.responseTime;
    }).reduce((a, b) => {
      return a + b;
    }, 0) / numberOfAttendees) / this.quiz.questionList.length)) || 0);
    currentRowIndex += 2;

    let nextColumnIndex = 1;
    this.ws.cell(currentRowIndex, nextColumnIndex).string(this.mf('export.attendee_complete_correct'));
    currentRowIndex += 2;

    this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.attendee'));
    if (this._isCasRequired) {
      this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.cas_account_id'));
      this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.cas_account_email'));
    }
    this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.correct_questions'));
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.average_confidence'));
    }
    this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.overall_response_time'));
    this.ws.cell(currentRowIndex, nextColumnIndex++).string(this.mf('export.average_response_time'));
    currentRowIndex++;

    let nextStartRow = currentRowIndex + 5;
    this.leaderBoardData.forEach((leaderboardItem, indexInList) => {
      if (this.quiz.questionList.some((item, index) => ![QuestionType.SurveyQuestion, QuestionType.ABCDSingleChoiceQuestion].includes(item.TYPE)
                                                       && leaderboardItem.correctQuestions.indexOf((index)) === -1)) {
        return;
      }
      nextColumnIndex = 1;
      nextStartRow++;
      const targetRow = indexInList + currentRowIndex;
      this.ws.cell(targetRow, nextColumnIndex++).string(leaderboardItem.name);
      if (this._isCasRequired) {
        const profile = MemberDAO.getMembersOfQuiz(this.quiz.name).filter((nick: IMemberEntity) => {
          return nick.name === leaderboardItem.name;
        })[0].casProfile;
        this.ws.cell(targetRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(targetRow, nextColumnIndex++).string(profile.mail[0]);
      }
      const correctQuestionNumbers = this.leaderBoardData[indexInList].correctQuestions.map((item) => item + 1);
      this.ws.cell(targetRow, nextColumnIndex++).string(correctQuestionNumbers.join(', '));
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(targetRow, nextColumnIndex++).number(Math.round(leaderboardItem.confidenceValue));
      }
      this.ws.cell(targetRow, nextColumnIndex++).number(Math.round(leaderboardItem.responseTime));
      this.ws.cell(targetRow, nextColumnIndex++).number(Math.round((leaderboardItem.responseTime / this.leaderBoardData.length)));
    });

    if (nextStartRow === currentRowIndex + 5) {
      this.ws.cell(currentRowIndex, 1).string(this.mf('export.attendee_complete_correct_none_available'));
      nextStartRow++;
    }

    nextColumnIndex = 1;
    this.ws.cell(nextStartRow, nextColumnIndex).string(this.mf('export.attendee_all_entries'));
    nextStartRow += 2;

    this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.attendee'));
    if (this._isCasRequired) {
      this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.cas_account_id'));
      this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.cas_account_email'));
    }
    this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.correct_questions'));
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.average_confidence'));
    }
    this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.overall_response_time'));
    this.ws.cell(nextStartRow++, nextColumnIndex++).string(this.mf('export.average_response_time'));

    allResponses.forEach((responseItem, indexInList) => {
      nextColumnIndex = 1;
      const targetRow = indexInList + nextStartRow;
      this.ws.cell(targetRow, nextColumnIndex++).string(responseItem.name);
      if (this._isCasRequired) {
        const profile = MemberDAO.getMembersOfQuiz(this.quiz.name).filter((nick: IMemberEntity) => {
          return nick.name === responseItem.name;
        })[0].casProfile;
        this.ws.cell(targetRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(targetRow, nextColumnIndex++).string(profile.mail[0]);
      }
      const leaderboardItem = this._leaderBoardData.filter((item) => item.name === responseItem.name)[0];
      if (leaderboardItem) {
        if (leaderboardItem.correctQuestions.length > 0) {
          const correctQuestionNumbers = this._leaderBoardData[indexInList].correctQuestions.map((item) => item + 1);
          this.ws.cell(targetRow, nextColumnIndex++).string(correctQuestionNumbers.join(', '));
        }
        if (this.responsesWithConfidenceValue.length > 0) {
          this.ws.cell(targetRow, nextColumnIndex++).number(Math.round(this._leaderBoardData[indexInList].confidenceValue));
        }
        this.ws.cell(targetRow, nextColumnIndex++).number(Math.round(this._leaderBoardData[indexInList].responseTime));
        this.ws.cell(targetRow, nextColumnIndex++)
        .number(Math.round(this._leaderBoardData[indexInList].responseTime / this._leaderBoardData[indexInList].correctQuestions.length));
      } else {
        this.ws.cell(targetRow, nextColumnIndex++).string(this.mf('export.correct_questions_none_available'));
      }
    });
  }

  protected getLeaderboardData(): Array<ILeaderBoardItemBase> {
    const leaderBoard = new Leaderboard();
    return leaderBoard.sortBy(leaderBoard.buildLeaderboard(this.quiz), 'score');
  }

  private addLogoImage(): void {
    this.ws.addImage({
      path: path.join(staticStatistics.pathToAssets, 'images', 'logo_transparent.png'),
      type: 'picture',
      position: {
        type: 'twoCellAnchor',
        from: {
          col: 1,
          colOff: '1mm',
          row: 1,
          rowOff: '1mm',
        },
        to: {
          col: 1,
          colOff: '13mm',
          row: 2,
          rowOff: '11mm',
        },
      },
    });
  }
}
