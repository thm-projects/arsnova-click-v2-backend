import { ObjectId } from 'bson';
import { DeleteWriteOpResultObject } from 'mongodb';
import { Document } from 'mongoose';
import { UserRole } from '../enums/UserRole';
import { IUserSerialized } from '../interfaces/users/IUserSerialized';
import { UserModel, UserModelItem } from '../models/UserModelItem/UserModel';
import { AuthService } from '../services/AuthService';
import { AbstractDAO } from './AbstractDAO';

class UserDAO extends AbstractDAO {

  public static getInstance(): UserDAO {
    if (typeof this.instance === 'undefined') {
      this.instance = new UserDAO();
    }
    return this.instance;
  }

  public async getStatistics(): Promise<{ [key: string]: number }> {
    return {};
  }

  public validateUser(name: string, passwordHash: string): Promise<boolean> {
    return UserModel.exists({
      name,
      passwordHash,
    });
  }

  public validateTokenForUser(name: string, token: string): Promise<boolean> {
    return UserModel.exists({
      name,
      token,
      $where: function (): boolean {
        const decodedToken = AuthService.decodeToken(token);

        if (typeof decodedToken !== 'object' || !(decodedToken as any).name) {
          return false;
        }

        return (decodedToken as any).name === name;
      },
    });
  }

  public getUser(name: string): Promise<Document & UserModelItem> {
    return UserModel.findOne({ name }).exec();
  }

  public getUserByTokenHash(tokenHash: string): Promise<Document & UserModelItem> {
    return UserModel.findOne({ tokenHash }).exec();
  }

  public removeUser(id: ObjectId): Promise<DeleteWriteOpResultObject['result'] & { deletedCount?: number }> {
    return UserModel.deleteOne({ _id: id }).exec();
  }

  public addUser(user: IUserSerialized): Promise<Document & UserModelItem> {
    return UserModel.create(user);
  }

  public updateUser(id: ObjectId, changedFields: object): Promise<Document & UserModelItem> {
    return UserModel.updateOne({ _id: new ObjectId(id) }, changedFields).exec();
  }

  public getUserByToken(token: string): Promise<Document & UserModelItem> {
    return UserModel.findOne({ token }).exec();
  }

  public async getUsersByRole(role: UserRole): Promise<Array<Document & UserModelItem>> {
    return UserModel.find({ userAuthorizations: role }).exec();
  }

  public async getUserByPrivateKey(privateKey: string): Promise<Document & UserModelItem> {
    return UserModel.findOne({ privateKey }).exec();
  }
}

export default UserDAO.getInstance();
