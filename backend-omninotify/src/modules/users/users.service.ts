import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { mysqlPool } from '../../database/mysql.provider';

@Injectable()
export class UsersService {
  async findByEmail(email: string) {
    const [rows]: any = await mysqlPool.query(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    return rows[0];
  }

  async validatePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }
}
