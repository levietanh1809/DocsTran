class ProjectController {
    // Method to retrieve projects from the database
    async getProjects(req, res) {
        try {
            // Execute SQL query to get project details along with translation counts
            const projects = await query`
                SELECT 
                    p.*,
                    COUNT(t.Id) as TotalTranslations, // Count total translations for each project
                    SUM(CASE WHEN t.Status = 'completed' THEN 1 ELSE 0 END) as CompletedTranslations // Sum completed translations
                FROM Projects p
                LEFT JOIN TranslationSources ts ON p.Id = ts.ProjectId // Join with TranslationSources to link projects
                LEFT JOIN Translations t ON ts.Id = t.SourceId // Join with Translations to get translation status
                GROUP BY p.Id, p.Name, p.Description, p.CreatedAt, p.UpdatedAt // Group by project details
                ORDER BY p.CreatedAt DESC // Order projects by creation date
            `;
            
            // Render the projects view with the retrieved project data
            res.render('projects', {
                title: 'Quản lý dự án', // Set the title for the view
                projects: projects.recordset // Pass the project data to the view
            });
        } catch (error) {
            // Render the projects view with an error message if an error occurs
            res.render('projects', {
                title: 'Quản lý dự án', // Set the title for the view
                error: error.message // Pass the error message to the view
            });
        }
    }
} 