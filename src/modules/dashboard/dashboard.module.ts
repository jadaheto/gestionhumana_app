import { Module } from '@nestjs/common';
import { GetDashboardUseCase } from './application/use-cases/get-dashboard.use-case';
import { DashboardQueries } from './domain/dashboard-queries.port';
import { DashboardController } from './infrastructure/http/dashboard.controller';
import { SqlDashboardQueries } from './infrastructure/persistence/sql-dashboard-queries';

@Module({
  controllers: [DashboardController],
  providers: [GetDashboardUseCase, { provide: DashboardQueries, useClass: SqlDashboardQueries }],
})
export class DashboardModule {}
