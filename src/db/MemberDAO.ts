import { ObjectId } from 'bson';
import { MemberEntity } from '../entities/member/MemberEntity';
import { DbCollection, DbEvent } from '../enums/DbOperation';
import { IMemberSerialized } from '../interfaces/entities/Member/IMemberSerialized';
import { AbstractDAO } from './AbstractDAO';
import DbDAO from './DbDAO';

class MemberDAO extends AbstractDAO<Array<MemberEntity>> {

  constructor() {
    super([]);

    DbDAO.isDbAvailable.on(DbEvent.Connected, async (isConnected) => {
      if (isConnected) {
        const cursor = DbDAO.readMany(DbCollection.Members, {});
        cursor.forEach(doc => {
          this.addMember(doc);
        });
      }
    });
  }

  public static getInstance(): MemberDAO {
    if (!this.instance) {
      this.instance = new MemberDAO();
    }

    return this.instance;
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
  }

  public updateMember(id: ObjectId, updatedFields: { [key: string]: any }): void {
    const member = this.getMemberById(id);
    if (!member) {
      throw new Error(`Unkown updated quiz: ${id.toHexString()}`);
    }

    Object.keys(updatedFields).forEach(key => member[key] = updatedFields[key]);

    this.updateEmitter.emit(DbEvent.Change, member);
  }

  public removeAllMembers(): void {
    this.storage.forEach(member => this.updateEmitter.emit(DbEvent.Delete, member));
    this.storage.splice(0, this.storage.length);
  }

  public removeMember(id: ObjectId | string): void {
    const members = this.storage.splice(this.storage.findIndex(val => val.id.equals(id)), 1);

    if (members.length) {
      this.updateEmitter.emit(DbEvent.Delete, members[0]);
    }
  }

  public getMembersOfQuiz(quizName: string): Array<MemberEntity> {
    return this.storage.filter(val => val.currentQuizName === quizName);
  }

  public getMemberByToken(token: string): MemberEntity {
    return this.storage.find(val => val.token === token);
  }

  private getMemberById(id: ObjectId | string): MemberEntity {
    return this.storage.find(val => val.id.equals(id));
  }

}

export default MemberDAO.getInstance();