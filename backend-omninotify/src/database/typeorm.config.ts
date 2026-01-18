import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';

// import { Company } from '../modules/companies/entities/company.entity';
import { User } from '../modules/users/entities/user.entity';
import { Contact } from '../modules/contacts/entities/contact.entity';
import { Tag } from '../modules/tags/entities/tag.entity';
import { Template } from '../modules/templates/entities/template.entity';
import { ScheduledNotification } from '../modules/notifications/entities/scheduled-notification.entity';
import { NotificationLog } from '../modules/notifications/entities/notification-log.entity';
import { Provider } from '../modules/providers/entities/provider.entity';
import { CompanyProviderConfig } from '../modules/providers/entities/company-provider-config.entity';

dotenv.config();

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'omninotify',
  
  entities: [
    // Company,
    User,
    Contact,
    Tag,
    // Template,
    // ScheduledNotification,
    // NotificationLog,
    // Provider,
    // CompanyProviderConfig,
  ],
  autoLoadEntities: true,
  synchronize: false,
  logging: true,
  // timezone: 'UTC',
  charset: 'utf8mb4',
  timezone: '+00:00',
  //collation: 'utf8mb4_unicode_ci',
};