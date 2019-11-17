///<reference path="../lib/regExpEscape.ts" />

import { ObjectId } from 'bson';
import { MemberEntity } from '../entities/member/MemberEntity';
import { QuizEntity } from '../entities/quiz/QuizEntity';
import { DbCollection, DbEvent } from '../enums/DbOperation';
import { IMemberSerialized } from '../interfaces/entities/Member/IMemberSerialized';
import { IQuizEntity } from '../interfaces/quizzes/IQuizEntity';
import LoggerService from '../services/LoggerService';
import { AbstractDAO } from './AbstractDAO';
import DbDAO from './DbDAO';
import QuizDAO from './quiz/QuizDAO';

class MemberDAO extends AbstractDAO<Array<MemberEntity>> {

  public static getInstance(): MemberDAO {
    if (!this.instance) {
      this.instance = new MemberDAO();
    }

    return this.instance;
  }

  constructor() {
    super([]);

    DbDAO.isDbAvailable.on(DbEvent.Connected, async (isConnected) => {
      if (isConnected) {
        const cursor = DbDAO.readMany(DbCollection.Members, {});
        cursor.forEach(doc => {
          this.addMember(doc);
        }).then(() => LoggerService.info(`${this.constructor.name} initialized with ${this.storage.length} entries`));
      }
    });
  }

  public getMemberByName(name: string): MemberEntity {
    return this.storage.find(val => val.name === name);
  }

  public addMember(memberSerialized: IMemberSerialized): void {
    if (this.getMemberById(memberSerialized.id)) {
      throw new Error(`Duplicate member insertion: (name: ${memberSerialized.name}, id: ${memberSerialized.id})`);
    }

    const member = new MemberEntity(memberSerialized);
    this.storage.push(member);
    this.updateEmitter.emit(DbEvent.Create, member);

    if (QuizDAO.isInitialized) {
      this.notifyQuizDAO(member);
    } else {
      QuizDAO.updateEmitter.once(DbEvent.Initialized, () => this.notifyQuizDAO(member));
    }
  }

  public updateMember(id: ObjectId, updatedFields: { [key: string]: any }): void {
    const member = this.getMemberById(id);
    if (!member) {
      throw new Error(`Unknown updated member: ${id.toHexString()}`);
    }

    Object.keys(updatedFields).forEach(key => member[key] = updatedFields[key]);

    this.updateEmitter.emit(DbEvent.Change, member);
  }

  public removeAllMembers(): void {
    this.storage.forEach(member => {
      this.updateEmitter.emit(DbEvent.Delete, member);
      QuizDAO.getQuizByName(member.currentQuizName).onMemberRemoved(member);
    });
    this.storage.splice(0, this.storage.length);
  }

  public removeMember(id: ObjectId | string): void {
    const members = this.storage.splice(this.storage.findIndex(val => val.id.equals(id)), 1);

    if (members.length) {
      this.updateEmitter.emit(DbEvent.Delete, members[0]);
      const quiz = QuizDAO.getQuizByName(members[0].currentQuizName);
      if (quiz) {
        quiz.onMemberRemoved(members[0]);
      }
    }
  }

  public getMembersOfQuiz(quizName: string): Array<MemberEntity> {
    return this.storage.filter(val => !!val.currentQuizName.match(new RegExp(`^${RegExp.escape(quizName)}$`, 'i')));
  }

  public getMemberByToken(token: string): MemberEntity {
    return this.storage.find(val => val.token === token);
  }

  public removeMembersOfQuiz(removedQuiz: QuizEntity | IQuizEntity): void {
    DbDAO.deleteMany(DbCollection.Members, { currentQuizName: removedQuiz.name });
  }

  public getMemberAmountPerQuizGroup(name: string): object {
    const result = {};

    this.getMembersOfQuiz(name).forEach(member => {
      const targetResult = result[member.groupName];
      if (!targetResult) {
        result[member.groupName] = 1;
        return;
      }

      result[member.groupName]++;
    });

    return result;
  }

  private notifyQuizDAO(member: MemberEntity): void {
    const quiz = QuizDAO.getQuizByName(member.currentQuizName);
    if (!quiz) {
      console.error(`The quiz '${member.currentQuizName}' for the member ${member.name} could not be found. Removing member.`);
      DbDAO.deleteOne(DbCollection.Members, { _id: member.id });
      return;
    }
    QuizDAO.getQuizByName(member.currentQuizName).onMemberAdded(member);
  }

  private getMemberById(id: ObjectId | string): MemberEntity {
    return this.storage.find(val => val.id.equals(id));
  }
}

export default MemberDAO.getInstance();
