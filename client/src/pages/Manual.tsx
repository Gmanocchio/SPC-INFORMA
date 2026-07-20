import React, { useState, useEffect } from 'react';
import { useAuth } from "@/_core/hooks/useAuth";
import { manualContent, ManualSection } from "@/lib/manual-content";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'wouter';

const Manual: React.FC = () => {
  const { user } = useAuth();
  const [filteredContent, setFilteredContent] = useState<ManualSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const content = manualContent.filter(section =>
        section.roles.includes(user.role)
      );
      setFilteredContent(content);
      if (content.length > 0) {
        setActiveSection(content[0].title);
      }
    }
  }, [user]);

  if (!user) {
    return <div className="p-4">Carregando informações do usuário...</div>;
  }

  if (filteredContent.length === 0) {
    return <div className="p-4">Nenhum manual disponível para o seu perfil.</div>;
  }

  const currentSection = filteredContent.find(section => section.title === activeSection);

  return (
    <div className="flex h-full">
      <aside className="w-64 bg-gray-100 p-4 border-r">
        <h2 className="text-lg font-semibold mb-4">Seções do Manual</h2>
        <nav>
          <ul>
            {filteredContent.map(section => (
              <li key={section.title} className="mb-2">
                <a
                  href="#"
                  onClick={() => setActiveSection(section.title)}
                  className={`block p-2 rounded ${activeSection === section.title ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        {currentSection ? (
          <article className="prose lg:prose-xl">
            <h1>{currentSection.title}</h1>
            <p className="text-gray-600 mb-4">{currentSection.description}</p>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentSection.content}
            </ReactMarkdown>
          </article>
        ) : (
          <div className="p-4">Selecione uma seção para visualizar o conteúdo.</div>
        )}
      </main>
    </div>
  );
};

export default Manual;
